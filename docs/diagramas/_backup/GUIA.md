# Guia dos diagramas — CLTech

Tudo o que falta para fechar a seção 5 do ERS. Os diagramas de **sequência** já estão
prontos; este guia cobre os outros quatro.

| # | Diagrama | Fonte | Formato | Seção do ERS |
|---|---|---|---|---|
| 1 | Casos de Uso | [`01-casos-de-uso.puml`](./01-casos-de-uso.puml) | PlantUML | 5.1 |
| 2 | Classes | [`02-classes.mmd`](./02-classes.mmd) | Mermaid | 5.2 |
| 3 | Entidade-Relacionamento (DER) | [`03-der.mmd`](./03-der.mmd) | Mermaid | — (entregável 8) |
| 4 | Atividade — Candidatura (RF03) | [`04-atividade-candidatura.puml`](./04-atividade-candidatura.puml) | PlantUML | 5.4.1 |
| 5 | Atividade — Correção automática (RF05+RF06) | [`05-atividade-correcao.puml`](./05-atividade-correcao.puml) | PlantUML | 5.4.2 |
| — | Sequência (2) | já feitos pela equipe | — | 5.3 |

Por que dois formatos: **Mermaid** renderiza sozinho dentro do GitHub (bom para classes e
DER, que a equipe vai consultar o tempo todo); **PlantUML** tem notação UML de verdade para
casos de uso (`<<include>>`, `<<extend>>`, generalização de ator) e para atividade
(raias, `fork`/`join`), que o Mermaid não faz direito.

---

## Como renderizar e exportar

### Mermaid (`.mmd`) — classes e DER

1. Abra <https://mermaid.live>
2. Cole o conteúdo do arquivo
3. **Actions → PNG** (para colar no ERS) ou **SVG** (melhor qualidade)

Alternativa sem sair do editor: extensão *Markdown Preview Mermaid Support* no VS Code.

### PlantUML (`.puml`) — casos de uso e atividade

1. Abra <https://www.plantuml.com/plantuml/uml/>
2. Cole o conteúdo e pressione *Submit*
3. Botão direito na imagem → *Salvar imagem como…* (PNG)

Alternativa: extensão *PlantUML* do VS Code (`Alt+D` para pré-visualizar, `Ctrl+Shift+P →
PlantUML: Export Current Diagram` para exportar).

### Onde salvar

A convenção do [`docs/README.md`](../README.md) pede **fonte e imagem**:

```text
docs/diagramas/
├── 01-casos-de-uso.puml          ← fonte (já criada)
├── 01-casos-de-uso.png           ← exportar
├── 02-classes.mmd
├── 02-classes.png
├── 03-der.mmd
├── 03-der.png
├── 04-atividade-candidatura.puml
├── 04-atividade-candidatura.png
├── 05-atividade-correcao.puml
└── 05-atividade-correcao.png
```

---

## 1. Diagrama de Casos de Uso

**Cobre**: RF01 a RF09 do ERS, seção 2.1.

**Decisões de modelagem** que valem ser defendidas na apresentação:

- **Administrador generaliza Recrutador** (`ADM --|> REC`). O ERS trata os dois juntos em
  todo lugar ("papel Recrutador ou Administrador"). Generalização evita duplicar oito
  associações e mostra que Admin *é um* Recrutador com poderes extras.
- **Motor de IA, Sandbox e API do GitHub são atores**, não casos de uso. Ator é quem
  *inicia* ou *participa* de uma interação — a triagem (UC10) e a correção (UC06) rodam
  sozinhas, sem pessoa envolvida. Modelá-las como caso de uso do Candidato seria errado: ele
  não as executa.
- **UC03 `<<include>>` UC10**: é a RN001 desenhada. Candidatar-se *sempre* dispara a
  triagem; não é opcional, por isso `include` e não `extend`.
- **`<<extend>>` para o que é opcional**: filtrar vagas, entrar por OAuth, anexar currículo.
  O fluxo funciona sem eles.

### Texto para a seção 5.1 do ERS

> O diagrama de casos de uso apresenta três atores humanos — Candidato, Recrutador e
> Administrador — e três atores de sistema: o Motor de IA, o Sandbox de execução e a API do
> GitHub. O Administrador é modelado como uma generalização do Recrutador, refletindo a
> regra RN004, segundo a qual ambos os papéis compartilham o mesmo nível de acesso aos dados
> sensíveis dos candidatos.
>
> Os casos de uso do Candidato (UC01 a UC03 e UC05) formam o fluxo principal da demanda:
> autenticar-se, montar o perfil, candidatar-se e realizar o teste técnico. Os casos de uso
> do Recrutador (UC04, UC07 a UC09) concentram a configuração das vagas e a análise dos
> resultados já processados.
>
> Três casos de uso não têm ator humano: a triagem automática do currículo (UC10), a
> correção da submissão de código (UC06) e o envio de feedback (UC11). Isso é a
> materialização da regra RN001 — o recrutador nunca acessa uma listagem de candidatos que
> não tenha passado antes pelo motor de IA. O relacionamento `<<include>>` entre UC03
> (Candidatar-se) e UC10 (Triar currículo) expressa essa obrigatoriedade: não existe
> candidatura sem triagem.

---

## 2. Diagrama de Classes

**Cobre**: as 14 entidades de [`data-model.md`](../../specs/001-portal-candidatura/data-model.md)
— 9 ativas na Sprint 1 e 5 modeladas para as Sprints 2 e 3.

**Decisões de modelagem**:

- **`User` e `Candidate` são classes separadas, em relação 1:1.** `User` é identidade de
  acesso (serve a candidato, recrutador e admin); `Candidate` são os dados de quem se
  candidata. Recrutador não tem `Candidate`. É essa separação que faz a RN007 ser estrutural
  em vez de uma validação que alguém pode esquecer de chamar.
- **`ExternalAccount` ≠ `Account`.** `Account` (Auth.js) é *autenticação*;
  `ExternalAccount` é *coleta de portfólio*. São ciclos de vida diferentes: dá para
  desconectar a coleta do GitHub sem perder o login por GitHub.
- **`JobMatch` e `Application.matchScore` coexistem de propósito.** `JobMatch` é orientação
  ao candidato *antes* de se inscrever e pode ser recalculado; `matchScore` é o score
  congelado da inscrição, sujeito à RN003. Fundi-los faria um score imutável depender de
  dado volátil.
- **`Evaluation` não tem método de update.** A ausência é o ponto: a única operação é
  `versaoAtual()`, de leitura.

### Texto para a seção 5.2 do ERS

> O diagrama de classes reflete o modelo relacional completo da plataforma, incluindo as
> entidades das Sprints 2 e 3, que são criadas desde a Sprint 1 para evitar migração
> destrutiva com dados reais em produção.
>
> A separação entre `User` e `Candidate` é a decisão central do modelo. `User` representa a
> identidade de acesso e é compartilhada pelos três papéis do sistema; `Candidate` concentra
> os dados pessoais e profissionais de quem se inscreve. A relação 1:1 entre as duas, somada
> à unicidade do campo `email` em `User`, é o que garante estruturalmente a regra RN007 — um
> único perfil por candidato, independentemente de quantas vagas ele acesse ao longo do
> tempo.
>
> A classe `Evaluation` implementa a regra RN003. Ela não expõe nenhuma operação de
> alteração: a correção de um resultado se dá exclusivamente pela inserção de um novo
> registro com `version` incrementado, preservando o anterior. A decisão humana de avançar ou
> reprovar um candidato é registrada em `Application.status` e em
> `ApplicationStageHistory.decidedByUserId`, nunca sobre o score.
>
> As classes `Challenge`, `CodeDraft`, `CodeSubmission` e `JobMatch` estão modeladas, mas sem
> comportamento na Sprint 1.

---

## 3. Diagrama Entidade-Relacionamento (DER)

**Cobre**: o entregável 8 da Sprint 1. É a mesma informação do diagrama de classes, na
perspectiva do banco — chaves, tipos SQL e cardinalidade.

**O que destacar na apresentação** — são as três regras que o banco garante sozinho:

| Constraint | Regra que implementa |
|---|---|
| `UNIQUE (candidateId, jobId)` em `APPLICATION` | FR-022 — sem candidatura duplicada, **mesmo com duplo clique** |
| `UNIQUE (email)` em `USER` | RN007 — um perfil por e-mail |
| `UNIQUE (applicationId, challengeId)` em `CODE_SUBMISSION` | RN006 — tentativa única no teste |
| Trigger `BEFORE UPDATE` em `EVALUATION` | RN003 — score imutável até por acesso direto ao banco |

O argumento que vale a nota: **essas regras não estão em `if` no código.** Validação em
código falha sob concorrência — duas requisições simultâneas passam as duas pelo `SELECT` e
inserem as duas. A constraint não falha. É por isso que o `409 ALREADY_APPLIED` da API é
derivado da violação do índice, não de uma consulta prévia.

Campos marcados `CIFRADO` são os que recebem AES-256-GCM em coluna: `Candidate.phone`,
`CodeDraft.sourceCode` e `CodeSubmission.sourceCode`, além do conteúdo do arquivo de
currículo. `email` e `name` ficam em claro por necessidade técnica — ver
[D1](../../specs/001-portal-candidatura/ers-divergences.md#d1), e **prepare-se para essa
pergunta na banca**, porque o RNF05 pede o contrário.

---

## 4 e 5. Diagramas de Atividade

O ERS pede dois (seção 5.4). Os escolhidos são os dois processos que melhor representam a
solução:

**`04-atividade-candidatura.puml` — Candidatura a uma vaga (RF03)**
Cobre autenticação sob demanda, validação de currículo, criação da candidatura e o bloqueio
de inscrição duplicada. Tem três nós de decisão que são requisitos diretos: FR-023
(não autenticado → login → volta para a vaga), FR-024 (sem currículo → completar perfil) e
FR-022 (já inscrito → mostra status).

**`05-atividade-correcao.puml` — Teste e correção automática (RF05 + RF06)**
É o núcleo da demanda da 3aq. Cobre o laço de escrita/execução com autosave, a submissão por
tempo esgotado (RF05-A1), o isolamento do sandbox (RNF06), a reprovação por violação de
segurança (RF06-A1), a retentativa única por falha técnica (RF06-E1) e o `INSERT` — nunca
`UPDATE` — do `Evaluation`.

Os dois usam **raias** (Candidato / Sistema / Sandbox) porque a pergunta que o avaliador faz
é sempre "quem faz o quê" — e no RF06 a resposta importa: o código do candidato **nunca**
executa no processo da aplicação.

---

## Checklist antes de entregar

- [ ] Os 5 diagramas exportados como PNG ou SVG, ao lado das fontes
- [ ] Imagens coladas nas seções 5.1, 5.2, 5.3 e 5.4 do ERS
- [ ] Textos explicativos preenchidos (os placeholders "Inserir explicação…" do ERS)
- [ ] DER anexado ao ERS ou à pasta de entregas
- [ ] **Consistência com os diagramas de sequência já feitos**: conferir se usam os mesmos
      nomes de entidade deste modelo (`Application`, `ProcessStage`, `Evaluation`…) e os
      mesmos identificadores de requisito (RF03, RN006…). Se os de sequência foram feitos
      antes deste modelo, é bem provável que divirjam — vale uma revisão rápida
- [ ] Link do protótipo preenchido na seção 4 do ERS (hoje está `[Inserir Link do Figma]`)

## O que ainda está vazio no ERS

Descoberto na leitura do documento — não é diagrama, mas some junto na revisão:

| Seção | Estado atual |
|---|---|
| 4. Protótipo | `[Inserir Link do Figma/ou Github (SE HOUVER)]` e `"Siga as telas que pedi na sprint"` (3×) |
| 5.1 / 5.2 | `"Inserir explicação de partes importantes…"` — textos prontos acima |
| 5.3 | Numeração do sumário (5.2.x) não bate com a do corpo (5.3.x) |
| 6. Casos de Teste | Só CT001 e CT002 nomeados; conteúdo é da Sprint 3 |
| 7. Apêndices | Vazio |
