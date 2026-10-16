# Research — Painel de Recrutamento e Triagem Automática (Sprint 2)

**Data**: 2026-10-16
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Constituição**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)

Cada item resolve uma incógnita deixada aberta pelo `plan.md`. Mesmo critério de desempate
da Sprint 1 (Princípio VI): menos peças, custo recorrente zero, manutenível pela 3aq.

---

## R12. Algoritmo de compatibilidade (FR-033)

**Decisão**: score 0–100 = média ponderada de dois sinais, cada um calculado como
percentual de cobertura das `Job.technologies`:

```text
score = round(0.6 × coberturaCurrículo + 0.4 × coberturaGitHub)

coberturaCurrículo = (nº de tecnologias da vaga encontradas no texto extraído do currículo,
                       case-insensitive, por correspondência de palavra inteira)
                      / (nº total de tecnologias da vaga)

coberturaGitHub = (nº de tecnologias da vaga que coincidem com o nome de alguma linguagem
                    em GithubProfile.languages, ponderado por `share`)
                   / (nº total de tecnologias da vaga)
```

**Pesos 60/40 (currículo/GitHub)**: o currículo é a fonte que o candidato controla
diretamente e cobre tecnologias que não aparecem em código público (ex.: ferramentas de
gestão, metodologias, stacks usadas em projetos privados/corporativos) — é o sinal mais
completo. O GitHub prova competência prática mas só existe para quem conectou a conta e só
cobre o que está em repositório público. Pesos fixos e documentados em vez de "calibração de
modelo" (linguagem do cronograma do ERS) — são 2 números, mudá-los depois é 1 linha.

**Quando falta um dos dois sinais**: se não há currículo com texto extraído (extração
falhou ou arquivo ilegível) ou não há GitHub conectado/sincronizado, o score usa só o sinal
disponível, com peso 1.0 — **nunca** divide por um sinal ausente nem trata a ausência como
cobertura zero. Se nenhum dos dois sinais existir (sem currículo), não há score — ver FR-036
(a interface mostra "complete seu perfil", não um número).

**Justificativa auditável** (Princípio III): a função retorna, além do score,
`{ matched: string[], missing: string[] }` — as tecnologias da vaga encontradas e as que
faltaram, calculadas sobre a união dos dois sinais. É o que RF08 exibe como "skills
encontradas vs. exigidas".

**Alternativas consideradas**:
- *Pesos iguais (50/50)*: descartado — subestima candidatos sem GitHub (boa parte do
  público-alvo), que ficariam artificialmente limitados a 50% mesmo com currículo perfeito.
- *TF-IDF / embeddings de texto*: mais sofisticado, mas não determinístico o suficiente para
  a RN003 sem fixar seed/versão de modelo, e é exatamente o tipo de complexidade que o D11
  decidiu evitar nesta sprint.

---

## R13. Extração de texto do currículo (FR-032)

**Decisão**: `pdf-parse` para PDF, `mammoth` (função `extractRawText`) para DOCX. Ambas
puras em JavaScript, sem binário externo, rodando no runtime Node do Next.js (não Edge).

**Quando falhar**: PDF escaneado como imagem (sem camada de texto), arquivo corrompido que
passou pela validação de magic number, ou exceção de parsing — `Resume.parseStatus` vira
`FAILED`, `extractedText` fica `null`, e o cálculo de compatibilidade (R12) usa só o sinal
de GitHub, se houver. **Nunca bloqueia upload nem candidatura** — mesmo princípio de
degradação graciosa do GitHub (R6 da Sprint 1).

**Onde roda**: dentro da própria rota de upload (`POST /api/me/resume`), não em fila
separada — extração de texto de um arquivo ≤ 5 MB é da ordem de dezenas de milissegundos
(nada de OCR, nada de modelo). Não precisa do padrão fire-and-forget usado para o GitHub.

**Cifra**: `extractedText` é cifrado com a mesma função `src/server/crypto.ts` (AES-256-GCM,
R4 da Sprint 1) — é conteúdo do currículo, mesmo padrão do arquivo original.

---

## R14. Quais avaliações (`Evaluation`) nascem em cada candidatura (FR-037)

**Decisão**: no momento em que uma `Application` é criada:

- **`RESUME_MATCH`** — sempre gerada. Usa o algoritmo de R12 inteiro (currículo + GitHub).
  É o "score final" que RF08 exibe com destaque.
- **`GITHUB_ANALYSIS`** — gerada **somente se** o candidato tem `GithubProfile` sincronizado
  **e** o pipeline da vaga inclui uma etapa do tipo `GITHUB_ANALYSIS`. Score = cobertura de
  GitHub isolada (sem o peso do currículo), para o recrutador ver o sinal de GitHub
  separado quando aquela etapa importa para esta vaga especificamente.
- **`CODE_TEST`** — nunca gerada nesta sprint (Sprint 3).

**Rationale**: amarrar `GITHUB_ANALYSIS` à configuração do pipeline (não gerar sempre que
há GitHub conectado) respeita a intenção do RF04 — é o recrutador quem decide, por vaga, se
a análise de GitHub importa o suficiente para aparecer como critério próprio. Em vagas sem
essa etapa, o sinal de GitHub ainda entra no `RESUME_MATCH` (R12), só não vira uma linha de
avaliação separada.

**Versionamento**: se o currículo ou o GitHub do candidato mudar *depois* da candidatura, as
`Evaluation` já existentes não mudam (são a fotografia do momento da inscrição, RN003);
seria necessário um reprocessamento explícito (fora do escopo desta sprint, mas o
`version + 1` em `INSERT` já suporta isso quando precisar — ver [D7](../001-portal-candidatura/ers-divergences.md#d7)).

---

## R15. Métricas do painel sem violar o orçamento de 3 s (FR-045, RNF03)

**Decisão**: as três métricas (tempo médio por etapa, taxa de avanço por etapa, gargalo)
são calculadas com agregação SQL (`GROUP BY stageId`, `AVG(exitedAt - enteredAt)`) direto em
`ApplicationStageHistory`, filtrado pelas vagas do recrutador (ou por uma vaga específica
quando o filtro do FR-044 está ativo) — uma única query por métrica, nunca uma por
candidatura (sem N+1).

**Sem cache/pré-cálculo nesta sprint**: ao contrário de `JobMatch` (que precisa ser
pré-calculado porque multiplica por candidato × vaga × NLP), aqui é uma agregação sobre um
volume pequeno (dezenas de candidaturas no protótipo) — cabe no RNF03 sem camada extra.
Se o volume crescer, o próximo passo é materializar a agregação, não mudar o algoritmo.

**Etapas sem nenhuma movimentação ainda**: entram na agregação com contagem zero, não são
omitidas — evita o painel parecer incompleto quando uma vaga acabou de ser publicada.

---

## R16. Reordenação do pipeline sem drag-and-drop (FR-042)

**Decisão**: lista com botões "subir"/"descer" por etapa, mais "adicionar" (abre um seletor
com os 6 tipos fixos) e "remover". Cada clique dispara `PUT /api/recruiter/jobs/{id}/stages`
com a lista completa reordenada — sem estado otimista complexo, sem biblioteca de
drag-and-drop.

**Rationale**: a função é idêntica a arrastar-e-soltar (reordenar uma lista pequena, tipicamente
4-6 itens) sem precisar aprender ou integrar `@dnd-kit`/`react-beautiful-dnd` em 10 dias. Pode
virar drag-and-drop depois sem mudar o contrato da API (ela já recebe/devolve a lista ordenada
inteira).

---

## Incógnitas remanescentes

Nenhuma bloqueia o início da implementação.

| Incógnita | Decidir até | Impacto se não decidir |
|---|---|---|
| Aval do professor sobre o RF07 ([D4](../001-portal-candidatura/ers-divergences.md#d4)) | antes da entrega (26/Out) | herdado da Sprint 1, ainda em aberto |
| Pesos 60/40 do R12 são um chute informado, não calibrado com dados reais | revisar se houver reclamação de candidatos/recrutadores sobre o score não fazer sentido | score continua determinístico e explicável mesmo que os pesos estejam longe do ideal — não é um risco de correção, só de precisão |
