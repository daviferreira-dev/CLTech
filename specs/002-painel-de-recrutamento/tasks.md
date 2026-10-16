# Tasks: Painel de Recrutamento e Triagem Automática (Sprint 2)

**Input**: `plan.md`, `spec.md`, `data-model.md`, `contracts/api.md`, `research.md`
**Branch**: `002-painel-de-recrutamento`

Convenção: `[P]` = paralelizável (arquivos diferentes, sem dependência entre si).
Cada tarefa cita o arquivo alvo e o requisito que a origina. Toda tela ganha uma tarefa de
estilização própria, separada da tarefa que liga os dados — reaproveitando o vocabulário
visual já em uso no site (paleta `slate`, `rounded border border-slate-200/300`, botão
primário `bg-slate-900 text-white rounded px-4 py-2`, texto secundário
`text-sm text-slate-500/600`), nunca introduzindo paleta nova sem necessidade.

---

## Fase 1 — Setup

- [x] T001 Instalar dependências de produção novas: `pdf-parse`, `mammoth` (extração de texto, R13)
- [x] T002 Escrever migração Prisma aditiva — `Resume.extractedText TEXT?` — `prisma/migrations/<ts>_resume_extracted_text/migration.sql`

**Checkpoint**: `pnpm prisma migrate dev` aplica sem erro; `pnpm build` continua passando.

---

## Fase 2 — Fundação (bloqueia todas as user stories)

- [x] T003 [P] `src/server/matching/text-extract.ts` — `extractText(buffer, mimeType): string | null`, PDF via `pdf-parse`, DOCX via `mammoth`; nunca lança exceção, retorna `null` em qualquer falha (R13)
- [x] T004 [P] `src/server/matching/score.ts` — função pura `computeScore(jobTechnologies, { resumeText, githubLanguages }): { score, matched, missing }`, pesos 60/40 currículo/GitHub, reponderação quando falta um sinal (R12)
- [x] T005 `src/server/matching/recompute.ts` — `recomputeJobMatchesForCandidate(candidateId)` e `recomputeJobMatchesForJob(jobId)`, upsert em `JobMatch` (FR-034, gatilhos do `data-model.md`)
- [x] T006 [P] Estender `src/server/candidates/resume.ts` — chama `text-extract` no upload, grava `extractedText` cifrado (mesma função de `src/server/crypto.ts`) + `parseStatus`, dispara `recomputeJobMatchesForCandidate` (FR-032, gatilho 1)
- [x] T007 [P] Estender `src/server/candidates/external-accounts.ts` (sync do GitHub) — dispara `recomputeJobMatchesForCandidate` após sincronização bem-sucedida (FR-034, gatilho 2)
- [x] T008 [P] `src/lib/validation/` — schemas Zod novos: criação/edição de vaga, lista de etapas, decisão (avançar/reprovar), busca de candidatos

**Checkpoint**: `score.ts` e `text-extract.ts` são testáveis isoladamente, sem HTTP nem banco; score é comprovadamente determinístico para a mesma entrada.

---

## Fase 3 — User Story 1: Ver a compatibilidade com uma vaga antes de decidir (P1)

**Objetivo**: candidato autenticado vê o percentual de compatibilidade em cada vaga publicada; visitante e candidato sem currículo nunca veem um número.
**Teste independente**: candidato com currículo abre `/vagas`, vê percentuais; troca de currículo muda o percentual; deslogado não vê nada.

- [x] T009 [US1] Estender `src/server/jobs/list.ts` — injeta `matchScore` por item lendo `JobMatch` quando há sessão de candidato autenticada; nunca calcula na leitura (FR-033, FR-035)
- [x] T010 [US1] Estender `src/server/jobs/detail.ts` — injeta `matchScore` com `matched`/`missing` (mesma regra de FR-035, FR-036)
- [x] T011 [US1] `GET /api/jobs` e `GET /api/jobs/{id}` — refletir o contrato estendido de `contracts/api.md`
- [x] T012 [US1] [P] Estilização de `src/app/(public)/vagas/JobsList.tsx` — pill de compatibilidade por item (`rounded-full bg-slate-900 text-white text-xs px-2 py-0.5`, ex. "72% match"), texto `text-sm text-slate-500` ("Complete seu perfil para ver seu match") quando `NEEDS_RESUME`, nada quando sem sessão
- [x] T013 [US1] [P] Estilização de `src/app/(public)/vagas/[id]/JobDetail.tsx` — seção com duas listas (`text-sm`) de tecnologias encontradas vs. faltando, usando a mesma paleta `slate` do resto da tela (sem introduzir verde/vermelho)
- [x] T014 [US1] [P] Teste de integração — recálculo dispara nos 3 gatilhos (upload de currículo, sync de GitHub, publicação de vaga) e nunca no caminho de uma leitura — `tests/integration/matching-recompute.test.ts`
- [x] T015 [US1] [P] Teste de integração — score determinístico: mesma entrada produz mesmo resultado; pesos 60/40; fallback correto quando falta currículo ou GitHub — `tests/integration/matching-score.test.ts`
- [ ] T016 [US1] [P] Teste E2E Playwright — Fluxo 1 do `quickstart.md` — `tests/e2e/job-match.spec.ts`

**Checkpoint**: Fluxo 1 do `quickstart.md` passa manualmente e nos testes automatizados.

---

## Fase 4 — User Story 2: Montar o pipeline de seleção de uma vaga (P1)

**Objetivo**: recrutador cria vaga, monta e reordena o pipeline, publica; vaga publicada trava edição de stack/pipeline.
**Teste independente**: criar vaga, montar pipeline de 3 etapas em ordem específica, publicar, confirmar na listagem pública.

- [x] T017 [US2] `src/server/jobs/builder.ts` — `createJob`, `updateDraftJob` (recusa campos travados quando `PUBLISHED`, FR-041), `setStages` (substituição completa e ordenada, FR-039/042), `publishJob` (valida RN002, dispara `recomputeJobMatchesForJob`) (FR-038..042)
- [x] T018 [US2] `POST /api/recruiter/jobs` — `src/app/api/recruiter/jobs/route.ts`
- [x] T019 [US2] `PATCH /api/recruiter/jobs/{id}` — `src/app/api/recruiter/jobs/[id]/route.ts`
- [x] T020 [US2] `PUT /api/recruiter/jobs/{id}/stages` — `src/app/api/recruiter/jobs/[id]/stages/route.ts`
- [x] T021 [US2] `POST /api/recruiter/jobs/{id}/publish` — `src/app/api/recruiter/jobs/[id]/publish/route.ts`
- [x] T022 [US2] `GET /api/recruiter/jobs` — lista de vagas do recrutador com `candidateCount` (mesmo `route.ts` de T018, método GET)
- [x] T023 [US2] [P] Tela `src/app/(recruiter)/recrutamento/vagas/page.tsx` — lista de vagas do recrutador (rascunho/publicada)
- [x] T024 [US2] [P] Estilização de T023 — itens `rounded border border-slate-200 px-4 py-3` (padrão de "Minhas Candidaturas"), badge de status (`DRAFT` → `bg-slate-100 text-slate-600`; `PUBLISHED` → `bg-slate-900 text-white`), botão "Criar Vaga" primário
- [x] T025 [US2] [P] Tela `src/app/(recruiter)/recrutamento/vagas/nova/page.tsx` — formulário de campos da vaga + builder de pipeline (lista com adicionar/remover/subir/descer, R16)
- [x] T026 [US2] [P] Estilização de T025 — inputs/selects `rounded border border-slate-300 px-3 py-2` (padrão de `RegisterForm`/`JobsList`), etapas do pipeline como itens `rounded border border-slate-200 px-4 py-3` com botões de reordenar compactos, erro de campo pendente em `text-sm text-red-600` (padrão já usado em `RegisterForm`)
- [x] T027 [US2] [P] Tela `src/app/(recruiter)/recrutamento/vagas/[id]/page.tsx` — editar rascunho (reaproveita o builder de T025) ou visualizar vaga publicada em modo somente-leitura
- [x] T028 [US2] [P] Estilização de T027 — estado travado com aviso `text-sm text-slate-500` explicando por que stack/pipeline não editam (FR-041); reaproveita os componentes de T025/T026 desabilitados, não duplica o layout
- [x] T029 [US2] [P] Teste de integração obrigatório pela constituição — RN002: vaga sem tecnologias, sem requisitos mínimos ou sem etapas não publica, em nenhuma combinação — `tests/integration/job-publish.test.ts`
- [x] T030 [US2] [P] Teste de integração obrigatório pela constituição — FR-041: vaga `PUBLISHED` recusa alterar `technologies`/`minimumRequirements`/etapas — `tests/integration/job-lock.test.ts`
- [ ] T031 [US2] [P] Teste E2E Playwright — Fluxo 2 do `quickstart.md` — `tests/e2e/job-builder.spec.ts`

**Checkpoint**: Fluxo 2 passa; vaga criada pelo recrutador aparece em `/vagas` (pública) assim que publicada.

---

## Fase 5 — User Story 3: Ver o funil de contratação (P1)

**Objetivo**: painel consolidado com contagem por etapa, filtro por vaga, métricas de funil calculadas.
**Teste independente**: com candidatos em etapas diferentes, abrir o painel e conferir a contagem contra o banco.

- [x] T032 [US3] `src/server/jobs/dashboard.ts` — agregação SQL por etapa (`GROUP BY`), tempo médio por etapa, taxa de avanço, gargalo, filtro `jobId` opcional, sem N+1 (FR-043..045, R15)
- [x] T033 [US3] `GET /api/recruiter/dashboard` — `src/app/api/recruiter/dashboard/route.ts`
- [x] T034 [US3] [P] Tela `src/app/(recruiter)/recrutamento/page.tsx` — substitui o placeholder da Sprint 1: cards por vaga com contagem por etapa, seletor "todas"/vaga específica, métricas de funil, estado vazio orientando a criar a primeira vaga
- [x] T035 [US3] [P] Estilização de T034 — grid de cards `rounded border border-slate-200 p-4`, métricas em destaque `text-2xl font-semibold`, contagem por etapa em `text-sm text-slate-600`, estado vazio com link sublinhado (mesmo padrão de "Minhas Candidaturas" vazia)
- [ ] T036 [US3] [P] Teste E2E Playwright — Fluxo 3 do `quickstart.md` — `tests/e2e/dashboard.spec.ts`

**Checkpoint**: Fluxo 3 passa; painel reflete dados reais do banco em até 3 s (RNF03).

---

## Fase 6 — User Story 4: Analisar um candidato a fundo e decidir (P1)

**Objetivo**: relatório completo do candidato dentro de uma candidatura; recrutador avança/reprova; score nunca editável.
**Teste independente**: abrir candidato com score calculado, conferir todos os dados, registrar decisão, confirmar mudança de etapa.

- [x] T037 [US4] `src/server/applications/detail.ts` — `getApplicationDetail`: dados básicos, `evaluations` (RESUME_MATCH sempre, GITHUB_ANALYSIS se existir), contas externas, currículo, `codeTest: { status: "NOT_AVAILABLE_YET" | "PENDING" }` (FR-047, FR-048)
- [x] T038 [US4] `src/server/applications/decision.ts` — `recordDecision(ADVANCE | REJECT)`, grava `ApplicationStageHistory` com `decidedByUserId`, ignora qualquer campo de score recebido (FR-049, FR-050)
- [x] T039 [US4] `GET /api/recruiter/applications/{id}` — `src/app/api/recruiter/applications/[id]/route.ts`
- [x] T040 [US4] `POST /api/recruiter/applications/{id}/decision` — `src/app/api/recruiter/applications/[id]/decision/route.ts`
- [x] T041 [US4] [P] Tela `src/app/(recruiter)/recrutamento/vagas/[id]/candidaturas/[applicationId]/page.tsx` — relatório completo + ações avançar/reprovar
- [x] T042 [US4] [P] Estilização de T041 — duas colunas em ≥768px (dados básicos + score à esquerda, currículo/GitHub/teste à direita; empilhado em mobile), score em `text-3xl font-semibold`, justificativa reusando o padrão de listas de T013, botão avançar `bg-slate-900 text-white rounded px-4 py-2`, reprovar como outline `border border-slate-300 rounded px-4 py-2`
- [x] T043 [US4] [P] Teste de integração obrigatório pela constituição — tentativa de enviar score em `/decision` é ignorada, score nunca muda (Princípio II, FR-050) — `tests/integration/evaluation-decision-immutable.test.ts`
- [x] T044 [US4] [P] Teste de integração obrigatório pela constituição — nenhuma `Application` é criada sem `Evaluation(RESUME_MATCH)` junto, na mesma transação (Princípio III) — `tests/integration/evaluation-on-apply.test.ts`
- [ ] T045 [US4] [P] Teste E2E Playwright — Fluxo 4 do `quickstart.md` — `tests/e2e/application-detail.spec.ts`

**Checkpoint**: Fluxo 4 passa; decisão do recrutador move a candidatura de etapa de fato.

---

## Fase 7 — User Story 5: Buscar e reaproveitar candidatos já conhecidos (P2)

**Objetivo**: busca por nome/e-mail/tecnologia entre todos os candidatos, agrupada por pessoa.
**Teste independente**: candidato com candidaturas em duas vagas aparece agrupado numa busca pelo e-mail.

- [x] T046 [US5] `src/server/candidates/search.ts` — busca por nome/e-mail/tecnologia, agrupa por candidato único via e-mail (FR-051, FR-052, RN007)
- [x] T047 [US5] `GET /api/recruiter/candidates` — `src/app/api/recruiter/candidates/route.ts`
- [x] T048 [US5] [P] Tela `src/app/(recruiter)/recrutamento/candidatos/page.tsx` — busca + lista agrupada + link manual de "convidar para nova vaga" (sem envio de e-mail real — ver D6)
- [x] T049 [US5] [P] Estilização de T048 — campo de busca `rounded border border-slate-300 px-3 py-2 w-full`, candidato como card `rounded border border-slate-200` com candidaturas aninhadas (`border-t border-slate-100` entre itens), estado vazio igual ao padrão de `JobsList`
- [ ] T050 [US5] [P] Teste E2E Playwright — Fluxo 5 do `quickstart.md` — `tests/e2e/candidate-search.spec.ts`

**Checkpoint**: US5 pode ser cortada sem quebrar US1-US4 (consistente com a prioridade P2 do `spec.md`).

---

## Fase 8 — Polimento e portões obrigatórios da constituição

- [ ] T051 [P] Responsividade 360px–1280px nas 6 telas novas/alteradas desta sprint (lista de vagas do recrutador, criar/editar vaga, painel, detalhe do candidato, busca de candidatos) + revisão das 2 telas públicas que ganharam o indicador de match — sem rolagem horizontal (FR-054)
- [x] T052 [P] Conferir que `services/ai/README.md` e `ers-divergences.md` (D11 novo, D3 resolvido) estão consistentes com o código final — já escritos durante o planejamento, esta tarefa é a checagem final pós-implementação
- [x] T053 [P] Checklist de segredos — nenhuma variável de ambiente nova nesta sprint; `git status` limpo
- [ ] T054 Rodar `quickstart.md` do zero como alguém de fora da equipe (Definition of Done)

---

## Dependências entre fases

```text
Fase 1 (Setup)
    ↓
Fase 2 (Fundação — matching) ── bloqueia tudo abaixo
    ↓
Fase 3 (US1 — match do candidato) ─────┐
                                         │
Fase 4 (US2 — pipeline builder) ← independente de US1 em dados, mas painel/detalhe (US3/US4)
    ↓                                   │  só mostram algo com vagas/candidaturas reais criadas aqui
Fase 5 (US3 — painel) ← depende de US2 (precisa de vagas publicadas com candidatos)
    ↓
Fase 6 (US4 — detalhe do candidato) ← depende de US2 + US1 (Evaluation usa o mesmo motor de score)
    ↓
Fase 7 (US5 — busca) ← depende de US2 + US4 (histórico de candidaturas e decisões já existentes)
    ↓
Fase 8 (Polimento) ← depende de tudo acima
```

US1 é a única que não depende de US2 para existir tecnicamente (o motor de match funciona
mesmo sobre as vagas semeadas na Sprint 1), mas para demonstrar o fluxo completo de ponta a
ponta com vagas criadas pelo próprio recrutador, US2 deve vir antes na prática. US5 é a
única cortável sob pressão de prazo (mesmo padrão da US4/Sprint 1).

## Tarefas bloqueantes pela constituição (não negociáveis)

T029 (RN002), T030 (FR-041), T043 (Princípio II/RN003, reforço com dado real desta sprint)
e T044 (Princípio III — nenhuma candidatura sem avaliação prévia) implementam os quatro
testes exigidos por `research.md`/`quickstart.md` desta sprint. A sprint não está entregue
se qualquer um falhar.
