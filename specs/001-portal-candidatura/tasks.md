# Tasks: Portal de Candidatura (Sprint 1)

**Input**: `plan.md`, `spec.md`, `data-model.md`, `contracts/api.md`, `research.md`
**Branch**: `001-portal-candidatura`

Convenção: `[P]` = paralelizável (arquivos diferentes, sem dependência entre si).
Cada tarefa cita o arquivo alvo e o requisito que a origina.

---

## Fase 1 — Setup

- [x] T001 Inicializar projeto Next.js 15 (App Router, TypeScript, Tailwind) na raiz — `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- [x] T002 [P] Configurar ESLint + Prettier — `.eslintrc`, `.prettierrc`
- [x] T003 [P] Adicionar scripts `dev`, `build`, `test`, `test:e2e`, `db:seed` ao `package.json`
- [x] T004 Instalar dependências de produção: `next-auth@beta`, `@prisma/client`, `zod`, `argon2`, `@aws-sdk/client-s3` (storage S3-compatível)
- [x] T005 Instalar dependências de dev: `prisma`, `vitest`, `@playwright/test`, `tsx`

**Checkpoint**: `pnpm install` roda sem erro, `pnpm dev` sobe uma página em branco.

---

## Fase 2 — Fundação (bloqueia todas as user stories)

### Schema e banco

- [x] T006 Escrever `prisma/schema.prisma` com as 14 entidades de `data-model.md` (User, Account, Session, Candidate, ExternalAccount, GithubProfile, Resume, Job, ProcessStage, Application, ApplicationStageHistory, JobMatch, Challenge, CodeDraft, Evaluation, CodeSubmission) e todos os índices únicos (`User.email`; `Candidate.userId`; `ExternalAccount(candidateId,provider)`; `GithubProfile.candidateId`; `Application(candidateId,jobId)`; `ProcessStage(jobId,order)`; `JobMatch(candidateId,jobId)`; `CodeDraft(applicationId,challengeId)`; `CodeSubmission(applicationId,challengeId)`)
- [x] T007 Gerar migração inicial — `prisma/migrations/` (SQL gerado via `prisma migrate diff`; aplicar com `prisma migrate dev` exige Postgres rodando — ver nota de infra)
- [x] T008 Escrever migração SQL adicional com a trigger `BEFORE UPDATE ... RAISE EXCEPTION` em `Evaluation` (Princípio II / FR-028) — `prisma/migrations/<ts>_evaluation_immutability/migration.sql`
- [x] T009 [P] Escrever `prisma/seed.ts` — 1 RECRUITER, 1 ADMIN, 5 Jobs `PUBLISHED` (3 modalidades × 4 senioridades), 4–6 ProcessStage por vaga começando em `RESUME_ANALYSIS`, 1 Job `CLOSED` com Application pré-existente

### Infraestrutura transversal

- [x] T010 [P] `src/server/crypto.ts` — `encrypt`/`decrypt` AES-256-GCM, prefixo de versão `v1:`, IV aleatório por registro (R4)
- [x] T011 [P] `src/server/storage.ts` — upload e URL assinada de curta duração sobre bucket privado S3-compatível (R5)
- [x] T012 `src/server/auth/config.ts` — Auth.js (NextAuth v5): PrismaAdapter, estratégia `database`, provedores Credentials (Argon2id) + GitHub + LinkedIn opcional (R2)
- [x] T013 `src/server/auth/session.ts` — helpers `requireSession()`, `requireRole(role[])` para checagem server-side (FR-008, FR-017)
- [x] T014 `src/app/api/auth/[...nextauth]/route.ts` — handler do Auth.js
- [x] T015 [P] `src/lib/errors.ts` — formato único de erro `{ error: { code, message } }` e helper de resposta
- [x] T016 [P] `src/lib/validation/` — schemas Zod compartilhados (e-mail, senha, telefone, upload)

**Checkpoint**: `pnpm prisma migrate dev` cria o schema completo; `pnpm db:seed` popula sem erro; `pnpm prisma studio` mostra as 14 tabelas.

---

## Fase 3 — User Story 1: Entrar na plataforma (P1) 🎯 MVP

**Objetivo**: cadastro, login (credentials + OAuth), sessão persistente, redirecionamento por papel.
**Teste independente**: criar conta, sair, entrar de novo, confirmar sessão e destino por papel.

- [x] T017 [US1] `src/server/auth/register.ts` — função pura: cria `User` com papel `CANDIDATE`, hash Argon2id, e-mail normalizado para minúsculas, recusa duplicata sem revelar existência (FR-001, FR-004, FR-007)
- [x] T018 [US1] `POST /api/auth/register` — `src/app/api/auth/register/route.ts`, casca fina sobre T017, 201/409 conforme `contracts/api.md`
- [x] T019 [US1] [P] Tela `src/app/(auth)/cadastro/page.tsx` — formulário nome/e-mail/senha, chama o registro e autentica
- [x] T020 [US1] [P] Tela `src/app/(auth)/entrar/page.tsx` — login credentials + botões GitHub/LinkedIn (LinkedIn condicionado a `LINKEDIN_ID` presente — R2)
- [x] T021 [US1] Lógica de redirecionamento pós-login por papel — `src/server/auth/redirect.ts` (`CANDIDATE`→`/vagas`, `RECRUITER`/`ADMIN`→`/recrutamento`) (FR-006)
- [x] T022 [US1] Vínculo automático de provedor externo a conta existente pelo e-mail — configurar callback `signIn` no Auth.js (FR-003)
- [x] T023 [US1] [P] Tela mínima `src/app/(recruiter)/recrutamento/page.tsx` — placeholder "Painel chega na Sprint 2", acessível só a RECRUITER/ADMIN
- [x] T024 [US1] [P] Tela `src/app/(public)/page.tsx` — home com CTA para cadastro/login
- [x] T025 [US1] [P] Teste de integração — fluxo completo de cadastro + login + redirecionamento por papel — `tests/integration/auth.test.ts`
- [x] T026 [US1] [P] Teste E2E Playwright — Fluxo 1 do quickstart.md — `tests/e2e/auth.spec.ts`

**Checkpoint**: Fluxo 1 do `quickstart.md` passa manualmente e nos testes automatizados.

---

## Fase 4 — User Story 2: Montar o próprio perfil (P1)

**Objetivo**: editar dados básicos, conectar GitHub/LinkedIn/Lattes, upload de currículo.
**Teste independente**: preencher perfil, anexar currículo, conectar GitHub, recarregar e confirmar persistência.

- [x] T027 [US2] `src/server/candidates/profile.ts` — `getProfile`, `updateProfile` (FR-009), decifra `phone` para leitura
- [x] T028 [US2] `GET /api/me/profile` · `PATCH /api/me/profile` — `src/app/api/me/profile/route.ts`
- [x] T029 [US2] `src/server/integrations/github.ts` — coleta server-side (dados do usuário, repos públicos, eventos), linguagens ponderadas por tamanho, grava `GithubProfile`, degrada para `UNAVAILABLE` sem propagar erro (FR-011, FR-012, R6)
- [x] T030 [US2] `src/server/candidates/external-accounts.ts` — conectar/desconectar/sincronizar `ExternalAccount`, transições de estado de `data-model.md`
- [x] T031 [US2] `POST /api/me/external-accounts` · `DELETE /api/me/external-accounts/{provider}` · `POST /api/me/external-accounts/{provider}/sync` — `src/app/api/me/external-accounts/`
- [x] T032 [US2] `src/server/candidates/resume.ts` — validação de servidor (extensão + MIME + tamanho ≤5MB + magic number `%PDF`/`PK\x03\x04`), grava cifrado via storage.ts, marca `isCurrent` (FR-014, FR-015, FR-016)
- [x] T033 [US2] `POST /api/me/resume` (multipart) — `src/app/api/me/resume/route.ts`, 201/413/415
- [x] T034 [US2] `GET /api/resumes/{id}/download` — `src/app/api/resumes/[id]/download/route.ts`, checagem de papel obrigatória antes da URL assinada (FR-017) — **requer teste automatizado**
- [x] T035 [US2] [P] Tela `src/app/(candidate)/perfil/page.tsx` — dados básicos, contas externas, upload de currículo (drag-and-drop + seleção)
- [x] T036 [US2] [P] Teste de integração obrigatório pela constituição — candidato sem papel recrutador não acessa currículo de outro — `tests/integration/resume-access.test.ts` (Princípio I)
- [x] T037 [US2] [P] Teste de integração — upload inválido não substitui currículo vigente — `tests/integration/resume-upload.test.ts`
- [x] T038 [US2] [P] Teste E2E Playwright — Fluxo 2 do quickstart.md — `tests/e2e/profile.spec.ts`

**Checkpoint**: Fluxo 2 do `quickstart.md` passa; teste de acesso negado (T036) é bloqueante e passa.

---

## Fase 5 — User Story 3: Encontrar uma vaga e se candidatar (P1)

**Objetivo**: listar/filtrar vagas públicas, ver detalhes, candidatar-se sem duplicidade.
**Teste independente**: buscar, filtrar, abrir detalhes, candidatar-se, verificar status inicial; candidatura dupla simultânea resulta em uma só.

- [x] T039 [US3] `src/server/jobs/list.ts` — listagem paginada com filtros `workMode`/`seniority`/`technology`/`q`, só `PUBLISHED` (FR-018, FR-019)
- [x] T040 [US3] `GET /api/jobs` — `src/app/api/jobs/route.ts`
- [x] T041 [US3] `src/server/jobs/detail.ts` — detalhe + etapas; 404 exceto para candidato já inscrito (FR-020)
- [x] T042 [US3] `GET /api/jobs/{id}` — `src/app/api/jobs/[id]/route.ts`
- [x] T043 [US3] `src/server/applications/apply.ts` — cria `Application`, pré-condições (autenticado, papel CANDIDATE, vaga PUBLISHED, `Resume.isCurrent`), captura violação do índice único como `409 ALREADY_APPLIED` (FR-021, FR-022, FR-024) — **requer teste automatizado**
- [x] T044 [US3] `POST /api/jobs/{id}/apply` — `src/app/api/jobs/[id]/apply/route.ts`, 201/401/409/422 conforme `contracts/api.md`
- [x] T045 [US3] `src/server/applications/list.ts` + `GET /api/me/applications` — `src/app/api/me/applications/route.ts` (FR-025)
- [x] T046 [US3] [P] Tela `src/app/(public)/vagas/page.tsx` — listagem + filtros, acessível sem login
- [x] T047 [US3] [P] Tela `src/app/(public)/vagas/[id]/page.tsx` — detalhes + botão candidatar-se; redireciona a `/entrar` com retorno à vaga quando deslogado (FR-023)
- [x] T048 [US3] [P] Teste de integração obrigatório pela constituição — duas candidaturas simultâneas resultam em uma — `tests/integration/application-race.test.ts` (FR-022, SC-003)
- [x] T049 [US3] [P] Teste E2E Playwright — Fluxo 3 do quickstart.md — `tests/e2e/application.spec.ts`

**Checkpoint**: os três fluxos P1 do `quickstart.md` passam ponta a ponta. Isto já é um MVP demonstrável.

---

## Fase 6 — User Story 4: Acompanhar as próprias candidaturas (P2)

**Objetivo**: tela "Minhas Candidaturas" (reusa T045/T045-API).

- [x] T050 [US4] [P] Tela `src/app/(candidate)/candidaturas/page.tsx` — lista vaga, data, etapa atual; estado vazio orienta a explorar vagas
- [x] T051 [US4] [P] Teste E2E Playwright — duas candidaturas aparecem com status correto — `tests/e2e/my-applications.spec.ts`

**Checkpoint**: US4 pode ser cortada sem quebrar US1–US3 (confirmado — não há dependência reversa).

---

## Fase 7 — Polimento e portões obrigatórios da constituição

- [x] T052 [P] Responsividade 360px–1280px nas 8 telas — ajuste Tailwind, sem rolagem horizontal (FR-030, SC-006)
- [x] T053 [P] Teste de integração obrigatório — tentativa de `UPDATE` em `Evaluation` falha pela trigger — `tests/integration/evaluation-immutable.test.ts` (Princípio II, FR-028) — pode rodar assim que T008 existir, independe das user stories
- [x] T054 [P] Checklist de segredos — conferir que nada em `.env.local` está versionado, `git status` limpo
- [x] T055 Revisar `README.md` "Como rodar" contra o setup real após T001–T016 (atualizar se algo divergiu)
- [x] T056 Rodar `quickstart.md` do zero como alguém de fora da equipe (Definition of Done) — achou e corrigiu: ESLint sem ignorar `.next/`, `trustHost` ausente no Auth.js (quebra `next start` fora da Vercel), bucket de currículos nunca criado no Supabase Storage, Playwright em paralelo esgotando o pool de conexões do Postgres, `__dirname` em specs ESM, locator `getByRole("Entrar")` ambíguo após botão do GitHub

---

## Dependências entre fases

```text
Fase 1 (Setup)
    ↓
Fase 2 (Fundação) ── bloqueia tudo abaixo
    ↓
Fase 3 (US1) ─────┐
    ↓              │
Fase 4 (US2) ← depende de US1 (candidato autenticado)
    ↓              │
Fase 5 (US3) ← depende de US1 + US2 (perfil com currículo)
    ↓              │
Fase 6 (US4) ← depende de US3 (lista candidaturas existentes)      │
    ↓                                                               │
Fase 7 (Polimento) ← depende de tudo acima, mas T053 só de T008 ───┘
```

US1, US2 e US3 são sequenciais na prática (cada uma consome dado da anterior), mesmo
sendo "independentemente testável" no sentido da spec (cada uma tem seed/fixture próprio
para teste isolado). US4 é a única cortável sob pressão de prazo.

## Tarefas bloqueantes pela constituição (não negociáveis)

T036, T043 (parte do teste em T048) e T053 implementam os três testes exigidos por
`research.md` R8 / `quickstart.md`. A sprint não está entregue se qualquer um falhar.
