# Quickstart — Painel de Recrutamento e Triagem Automática (Sprint 2)

Como provar que a Sprint 2 funciona. Pressupõe o ambiente da Sprint 1 já rodando — nenhuma
infraestrutura nova entra nesta sprint ([plan.md](./plan.md)). Detalhes de domínio em
[data-model.md](./data-model.md); contratos em [contracts/api.md](./contracts/api.md).

## Pré-requisitos

Os mesmos da Sprint 1 — Node.js 20+, pnpm, acesso ao projeto Supabase (banco + storage),
`.env` preenchido. Nenhuma variável de ambiente nova.

## Setup

```bash
pnpm install                 # pega pdf-parse e mammoth, novos desta sprint
pnpm prisma generate         # obrigatório: não há postinstall no package.json
pnpm prisma migrate dev      # aplica a coluna Resume.extractedText
pnpm db:seed                 # recrutador@3aq.dev + 5 vagas publicadas (Fluxos 2, 3 e 5)
pnpm build && pnpm start     # http://localhost:3000 — ver por que não `pnpm dev` no README
```

Pular o `prisma generate` faz o Vitest morrer com um `ERR_MODULE_NOT_FOUND` em um worker,
sem citar o Prisma — o erro não diz qual é o passo que faltou.

## Validação manual — as cinco histórias

**Fluxo 1 — compatibilidade antes de se candidatar (User Story 1)**
1. Como candidato com currículo PDF anexado, abrir `/vagas` → cada vaga mostra um
   percentual de compatibilidade.
2. Abrir uma vaga (`/vagas/{id}`) → ver quais tecnologias exigidas foram encontradas no
   perfil e quais faltaram.
3. Trocar o currículo por um com stack diferente → voltar a `/vagas` → o percentual mudou.
4. Deslogar → abrir `/vagas` → nenhum percentual aparece, para nenhuma vaga.
5. Logar com um candidato **sem** currículo vigente → `/vagas` mostra "complete seu perfil"
   em vez de um número.

**Fluxo 2 — montar o pipeline de uma vaga (User Story 2)**
1. Como `recrutador@3aq.dev`, abrir "Minhas Vagas" → "Criar Vaga".
2. Preencher título, descrição, tecnologias, requisitos mínimos → salvar como rascunho.
3. Tentar publicar sem nenhuma etapa configurada → bloqueado, campos pendentes destacados.
4. Adicionar 3 etapas (ex.: Análise de Currículo, Análise de GitHub, Entrevista Técnica),
   reordenar com os botões subir/descer → salvar.
5. Publicar → a vaga aparece em `/vagas` (listagem pública) com o pipeline configurado.
6. Tentar editar as tecnologias exigidas da vaga já publicada → recusado.

**Fluxo 3 — ver o funil de contratação (User Story 3)**
1. Com ao menos duas vagas publicadas e candidatos em etapas diferentes, abrir
   `/recrutamento` (painel).
2. Conferir que a contagem de candidatos por etapa bate com o banco.
3. Alternar de "todas as vagas" para uma vaga específica → os números mudam.
4. Conferir que aparece o tempo médio por etapa e qual etapa é o gargalo.
5. Com um recrutador sem nenhuma vaga publicada → painel mostra orientação para criar a
   primeira vaga, não uma tela vazia.

**Fluxo 4 — analisar um candidato e decidir (User Story 4)**
1. Dentro de uma vaga, abrir um candidato inscrito → ver score, justificativa, contas
   externas, currículo (download) e "ainda não disponível" no teste de código.
2. Abrir um candidato sem GitHub conectado → aviso de dados indisponíveis, resto do
   relatório aparece normalmente.
3. Registrar "avançar" → a candidatura muda de etapa; histórico registra a mudança.
4. Confirmar que não existe, em lugar nenhum da tela, um campo para editar o score.

**Fluxo 5 — buscar candidatos já conhecidos (User Story 5, P2)**
1. Abrir "Candidatos" → buscar pelo e-mail de alguém que já se candidatou a duas vagas
   diferentes → as duas candidaturas aparecem agrupadas.
2. Buscar algo sem correspondência → mensagem de nenhum resultado.

## Verificações que provam os requisitos não-funcionais

| O que verificar | Como | Requisito |
|---|---|---|
| Score nunca calculado na requisição | `GET /api/jobs` não aumenta de latência com N vagas | FR-034, RNF03 |
| Texto do currículo cifrado | `SELECT "extractedText" FROM "Resume"` → ilegível, prefixo `v1:` | FR-032 |
| Score é imutável (reforçado com dado real) | `UPDATE "Evaluation" SET score = 100` numa linha gerada por uma candidatura real → exceção da trigger | FR-050, RN003 |
| Vaga publicada incompleta é impossível | tentar publicar sem tecnologias/etapas, em todos os casos → bloqueado | FR-040, SC-011 |
| Vaga publicada trava pipeline | `PATCH`/`PUT` em vaga `PUBLISHED` tentando mudar stack/etapas → `409` | FR-041 |
| Painel responde rápido | DevTools Network, `GET /api/recruiter/dashboard` com algumas dezenas de candidaturas → < 3 s | RNF03, SC-013 |
| Responsivo | DevTools em 360 px e 1280 px, percorrer os 5 fluxos → sem rolagem horizontal | FR-054 |

## Testes automatizados

```bash
pnpm exec playwright install chromium   # só na primeira vez
pnpm test                               # Vitest — matching, publish e lock
pnpm db:seed                            # obrigatório entre os dois — ver aviso abaixo
pnpm test:e2e                           # Playwright — os cinco fluxos, 360px e 1280px
```

**`pnpm test` apaga os dados do banco.** `tests/integration/setup.ts` dá
`TRUNCATE ... CASCADE` em todas as tabelas de domínio antes de cada teste, e o
`.env.test.example` aponta para o mesmo projeto Supabase do `.env`. Rodar a suíte de
integração derruba o seed; sem rodar `pnpm db:seed` de novo, o Playwright encontra `/vagas`
vazia e quase toda a suíte E2E falha com timeouts que não indicam a causa real.

`vitest.config.ts` recusa iniciar se o `.env.test.example` não existir ou se o
`DATABASE_URL` dele ainda estiver com os placeholders — antes esse caso caía em silêncio no
`DATABASE_URL` do `.env` e truncava o banco de desenvolvimento sem nenhum aviso.

Testes obrigatórios pela constituição nesta sprint:
1. Nenhuma candidatura é criada sem `Evaluation(RESUME_MATCH)` junto (Princípio III).
2. `UPDATE` em `Evaluation`/`JobMatch` falha, agora com dado real gerado pelo fluxo normal
   (Princípio II, reforço do T053 da Sprint 1).
3. Vaga sem tecnologias, sem requisitos ou sem etapa não publica, em nenhuma combinação
   (RN002).
4. Vaga publicada recusa alteração de stack/pipeline (FR-041).

## Definition of Done da Sprint 2

- [ ] As cinco histórias completáveis do zero por alguém de fora da equipe
- [ ] Nenhuma candidatura exibida ao recrutador sem avaliação automática prévia (Princípio III)
- [ ] Os quatro testes obrigatórios da constituição passando
- [ ] `services/ai/README.md` e `ers-divergences.md` refletem a decisão D11 (nada em silêncio)
- [ ] Nenhuma chave ou segredo novo necessário além dos já existentes
- [ ] Aplicação rodando em ambiente publicado, acessível pelo navegador
