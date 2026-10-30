# API Contracts — referência completa

**Atualizado**: 2026-10-24, conferido rota a rota contra `src/app/api/**/route.ts` e as funções de
`src/server` que cada rota chama. **Spec**: [../spec.md](../spec.md) · **Modelo**: [../data-model.md](../data-model.md)

Este arquivo cobre **todas as 32 rotas** da aplicação (Sprints 1, 2 e 3). O contrato da Sprint 1
([../../001-portal-candidatura/contracts/api.md](../../001-portal-candidatura/contracts/api.md))
fica como registro histórico; onde os dois divergem, vale este.

---

## Convenções

- Base `/api`. Corpo em JSON, exceto o upload de currículo (`multipart/form-data`).
- Autenticação por cookie de sessão do Auth.js, estratégia **JWT** ([D10](../../001-portal-candidatura/ers-divergences.md)).
- Papel verificado sempre no servidor (`requireRole`). Sem sessão → `401`; papel errado → `403`.
  Rotas `/api/recruiter/*` aceitam `RECRUITER` e `ADMIN`; rotas `/api/me/*` só `CANDIDATE`.
  A matriz completa é provada por `tests/integration/lgpd-access.test.ts`.
- A 3aq é uma organização só: qualquer recrutador enxerga todas as vagas e candidaturas.
- Formato único de erro:
  ```json
  { "error": { "code": "RESUME_REQUIRED", "message": "Anexe um currículo antes de se candidatar." } }
  ```
  Alguns erros acrescentam campos ao lado de `code` e `message` (ex.: `missing`, `remainingRuns`).

### Códigos de erro comuns

| HTTP | `code` | Quando |
|---|---|---|
| 400 | `VALIDATION_ERROR` | corpo ou query inválidos (mensagem do primeiro campo com erro) |
| 401 | `UNAUTHENTICATED` | sem sessão, ou sessão de usuário que não existe mais |
| 403 | `FORBIDDEN` | papel sem permissão |
| 404 | `NOT_FOUND` | recurso inexistente |
| 413 | `PAYLOAD_TOO_LARGE` | currículo acima de 5 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | currículo que não é PDF/DOCX válido |
| 500 | `INTERNAL_ERROR` | erro inesperado (detalhe só no log do servidor) |

Os códigos de regra de negócio (`409`/`422`/`503`) estão em cada rota.

---

## Autenticação — RF01

### `POST /api/auth/register` — público
Cria conta com papel `CANDIDATE` e já autentica.

**Body**: `{ name, email, password }` — senha com mínimo de 8 caracteres.
**201**: `{ user: { id, name, email, role: "CANDIDATE" } }` + cookie de sessão.
**409 `REGISTRATION_FAILED`**: e-mail já cadastrado. Mensagem genérica, não revela que o e-mail existe.

### `GET|POST /api/auth/[...nextauth]` — Auth.js
Login por e-mail e senha (`credentials`, Argon2id), GitHub e LinkedIn (este só quando
configurado), sessão e saída. OAuth com e-mail já cadastrado vincula à conta existente; no
primeiro acesso cria o usuário com papel `CANDIDATE` e o perfil de candidato. Tokens do
provedor **não** são gravados (spec 006).

### `GET /api/auth/post-login`
Redireciona conforme o papel da sessão: `CANDIDATE` → `/vagas`; `RECRUITER`/`ADMIN` →
`/recrutamento`; sem sessão → `/entrar`. É o `callbackUrl` de toda tela de login.

---

## Vagas e candidatura — RF03, RN001

### `GET /api/jobs` — público
**Query**: `q`, `technology`, `workMode`, `seniority`, `page`, `pageSize`.
**200**:
```json
{
  "items": [{
    "id": "…", "title": "…", "company": "…", "location": "…",
    "workMode": "REMOTE", "seniority": "MID", "technologies": ["React", "Node"],
    "matchScore": { "status": "CALCULATED", "value": 72 }
  }],
  "page": 1, "pageSize": 20, "total": 5
}
```
Só vagas `PUBLISHED`, mais recentes primeiro. `matchScore` só aparece para candidato logado:
`{ "status": "NEEDS_RESUME" }` sem currículo vigente; omitido sem sessão, para recrutador ou
quando ainda não foi calculado. Nunca calcula na hora: lê `JobMatch` (RNF03).

### `GET /api/jobs/{id}` — público
**200**: vaga + `status` + `stages: [{ type, order }]`; para candidato logado, também
`matchScore` com `matched` e `missing` (tecnologias encontradas e ausentes).
**404**: vaga inexistente ou não publicada, **exceto** para o candidato já inscrito nela.

### `POST /api/jobs/{id}/apply` — `CANDIDATE`
Calcula o score de compatibilidade e, **na mesma transação**, cria a candidatura na 1ª etapa,
o histórico de etapa e `Evaluation(RESUME_MATCH)` — mais `Evaluation(GITHUB_ANALYSIS)` se a vaga
tem essa etapa e o candidato tem GitHub coletado (RN001).

**201**: `{ applicationId, currentStage: { type, order }, appliedAt, matchScoreStatus: "CALCULATED" }`

| HTTP | `code` | Quando |
|---|---|---|
| 422 | `RESUME_REQUIRED` | sem currículo vigente |
| 422 | `JOB_NOT_OPEN` | vaga não publicada, ou sem etapas |
| 409 | `ALREADY_APPLIED` | já inscrito; a mensagem traz o status atual (vem do índice único, não de consulta prévia) |

### `GET /api/me/applications` — `CANDIDATE`
**200**: lista (array) de `{ applicationId, job: { id, title, company }, appliedAt, currentStage: { type, order }, status, matchScoreStatus }`.

---

## Perfil do candidato — RF02

### `GET /api/me/profile` — `CANDIDATE`
**200**:
```json
{
  "name": "…", "email": "…", "phone": "…", "city": "…", "state": "SP",
  "details": {
    "headline": "Dev Backend Pleno", "summary": "…",
    "technologies": ["Node"], "softSkills": ["Comunicação"],
    "experiences": [{ "company": "…", "role": "…", "startDate": "2024-01", "endDate": null, "isCurrent": true, "description": "…" }],
    "educations": [{ "institution": "…", "course": "…", "level": "GRADUACAO", "startDate": "…", "endDate": "…", "inProgress": false }],
    "languages": [{ "name": "Inglês", "level": "AVANCADO" }],
    "links": [{ "label": "Portfólio", "url": "https://…" }]
  },
  "externalAccounts": [{ "provider": "GITHUB", "status": "CONNECTED", "externalUsername": "…", "unavailableReason": null, "lastSyncedAt": "…" }],
  "githubProfile": { "publicRepoCount": 23, "languages": [{ "name": "TypeScript", "bytes": 1000, "share": 0.6 }], "activityLast90Days": 140, "collectedAt": "…" },
  "resume": { "id": "…", "originalFilename": "cv.pdf", "sizeBytes": 214003, "uploadedAt": "…" }
}
```
`phone` é decifrado no servidor. `githubProfile` e `resume` podem vir `null`.

### `PATCH /api/me/profile` — `CANDIDATE`
**Body** (todos opcionais): `name`, `phone` (8–20), `city`, `state` (UF, 2 letras), `headline`
(≤ 120), `summary` (≤ 2000), `technologies`, `softSkills`, `experiences`, `educations`,
`languages`, `links`. Cada lista enviada **substitui** a anterior inteira. Mudar `technologies`
recalcula a compatibilidade com as vagas.
**200**: o perfil no mesmo formato do `GET`.

### `POST /api/me/resume` — `CANDIDATE`
`multipart/form-data`, campo `file`. Validação no servidor: extensão, MIME, tamanho ≤ 5 MB e
assinatura do arquivo (`%PDF` / `PK\x03\x04`). Extrai o texto (cifrado em repouso) e recalcula a
compatibilidade em segundo plano.
**201**: `{ id, originalFilename, sizeBytes, uploadedAt, draft }` — `draft` é a sugestão de perfil
lida do currículo para a tela pré-preencher, ou `null` se o texto não pôde ser lido.
**413 / 415**: ver tabela comum. O currículo anterior continua vigente.

### `GET /api/resumes/{id}/download` — sessão
**200** com o arquivo original, decifrado no servidor (ver contrato da spec 001). Permitido ao dono do currículo e a `RECRUITER`/`ADMIN`;
qualquer outro → **403**.

### `POST /api/me/external-accounts` — `CANDIDATE`
**Body**: `{ provider: "GITHUB" | "LINKEDIN" | "LATTES", url? }`. Para o GitHub, `url` pode ser o
link do perfil ou o usuário; sem ele, usa a conta GitHub do login. Lattes é só link (já fica
`CONNECTED`).
**202**: `{ status: "PENDING" }`. A coleta do GitHub (API pública) roda fora da requisição; o
cliente consulta `GET /api/me/profile`. Falha do provedor nunca vira 5xx: vira
`status: "UNAVAILABLE"` com `unavailableReason`.

### `POST /api/me/external-accounts/{provider}/sync` — `CANDIDATE`
Nova tentativa de coleta. `{provider}` aceita maiúsculas ou minúsculas. **202** `{ status: "PENDING" }`.

### `DELETE /api/me/external-accounts/{provider}` — `CANDIDATE`
**204**. Vínculo passa a `DISCONNECTED`.

---

## LGPD — direitos do titular (spec 006)

### `GET /api/me/data-export` — `CANDIDATE`
**200**: arquivo `cltech-meus-dados.json` (`Content-Disposition: attachment`, `Cache-Control: no-store`)
com `exportedAt`, `account`, `profile` (dados decifrados), `externalAccounts`, `githubProfile`, `resumes` e `applications`.

### `DELETE /api/me/account` — `CANDIDATE`
**Body**: `{ confirmation: "EXCLUIR" }`. Exclui definitivamente a conta, o perfil, as candidaturas e os arquivos de currículo no storage.
**204**. **422 `CONFIRMATION_REQUIRED`**: confirmação ausente ou diferente.

---

## Construtor de vagas — RF04

### `GET /api/recruiter/jobs`
**200**: `{ items: [{ id, title, status, candidateCount, createdAt }] }` — rascunhos, publicadas e encerradas.

### `POST /api/recruiter/jobs`
**Body**: `{ title, description, company, location, workMode, seniority, technologies: string[], minimumRequirements }`.
**201**: a vaga como `DRAFT`, no formato de `GET /api/recruiter/jobs/{id}`.

### `GET /api/recruiter/jobs/{id}`
**200**: `{ id, title, description, company, location, workMode, seniority, technologies, minimumRequirements, status, publishedAt, stages: [{ id, type, order, config }] }`.

### `PATCH /api/recruiter/jobs/{id}`
**Body**: mesmos campos da criação, todos opcionais. **200**: a vaga atualizada.
**409 `JOB_LOCKED`**: alterar `technologies` ou `minimumRequirements` de vaga publicada. Os demais campos aceitam edição.

### `PUT /api/recruiter/jobs/{id}/stages`
Substitui o pipeline inteiro, numa transação serializável.
**Body**: `{ stages: [{ type, config? }] }` — a ordem do array é a ordem do pipeline. `type` ∈
`RESUME_ANALYSIS`, `CODE_TEST`, `GITHUB_ANALYSIS`, `HR_INTERVIEW`, `TECH_INTERVIEW`, `FINAL_OFFER`.
Para `CODE_TEST`, `config = { challengeId, languages?, timeLimitMinutes? }` — linguagens dentro
das do desafio (padrão: todas), prazo de 5 a 240 min (padrão 60). O limite de execuções de
teste é fixo em 20.
**200**: `{ stages: [{ id, type, order, config }] }`.
**409 `JOB_LOCKED`**: vaga publicada. **400**: desafio inexistente ou linguagem fora das do desafio.
Array vazio é aceito (rascunho); só a publicação o recusa.

### `POST /api/recruiter/jobs/{id}/publish`
`DRAFT → PUBLISHED`. Dispara em segundo plano o cálculo da compatibilidade dos candidatos.
**200**: `{ id, status: "PUBLISHED", publishedAt }`.
**422 `INCOMPLETE_JOB`** com a lista do que falta:
```json
{ "error": { "code": "INCOMPLETE_JOB", "message": "…", "missing": ["technologies", "minimumRequirements", "stages", "codeTest"] } }
```
`codeTest` = etapa de teste de código sem desafio escolhido.
**409 `ALREADY_PUBLISHED`**: a vaga não está em rascunho.

---

## Catálogo de desafios — RF05 (spec 005)

Leitura por `RECRUITER`/`ADMIN`; escrita só `ADMIN`. Casos ocultos **nunca** saem em nenhuma resposta.

### `GET /api/recruiter/challenges`
**200**: `{ items: [ChallengePublicView] }`.

### `GET /api/recruiter/challenges/{id}`
**200**: `ChallengePublicView` = `{ id, title, statement, languages, difficulty, timeLimitSeconds, visibleCases: [{ input, expectedOutput }], hiddenCaseCount }`.

### `POST /api/recruiter/challenges` — `ADMIN`
**Body**: `{ title, statement, languages: ("python"|"javascript"|"typescript"|"java"|"cpp"|"go")[], difficulty: "EASY"|"MID"|"HARD", timeLimitSeconds? (1–10, padrão 10), testCases: [{ input, expectedOutput, hidden }] }` — ao menos um caso visível.
**201**: `ChallengePublicView`.

### `PATCH /api/recruiter/challenges/{id}` — `ADMIN`
**Body**: os mesmos campos, opcionais. **200**: `ChallengePublicView`.
**409 `CHALLENGE_IN_USE`**: desafio já usado por uma vaga — casos, linguagens e tempo não mudam (cadastrar um novo).

---

## Teste de código do candidato — RF05 (spec 005)

Todas `CANDIDATE`, sobre a própria candidatura. O prazo é contado pelo relógio do servidor
desde a primeira abertura; consultas depois do prazo submetem o último rascunho automaticamente.

### `GET /api/me/code-tests`
**200**: `{ items: [{ applicationId, job: { id, title, company }, challengeTitle, difficulty, languages, timeLimitMinutes, state: "NOT_CONFIGURED"|"NOT_STARTED"|"IN_PROGRESS"|"SUBMITTED" }] }`.

### `GET /api/me/applications/{id}/code-test`
Abre ou retoma o desafio; na primeira abertura cria o rascunho e grava o início.
**200**: `CandidateChallengeView`:
```json
{
  "applicationId": "…", "job": { "id": "…", "title": "…", "company": "…" },
  "challenge": { "...": "ChallengePublicView" },
  "allowedLanguages": ["python"], "timeLimitMinutes": 60,
  "startedAt": "…", "deadline": "…", "serverNow": "…",
  "draft": { "language": "python", "sourceCode": "…", "savedAt": "…" },
  "testRunCount": 3, "maxTestRuns": 20, "remainingRuns": 17,
  "submission": null
}
```
`submission`, quando existe: `{ status: "GRADING"|"GRADED"|"FAILED", submittedAt, submittedBy: "CANDIDATE"|"TIME_EXPIRED" }` — sem nota.

| HTTP | `code` | Quando |
|---|---|---|
| 422 | `NOT_AVAILABLE_YET` | candidatura fora da etapa de teste de código |
| 422 | `CODE_TEST_NOT_CONFIGURED` | etapa sem desafio, ou desafio removido |

### `PUT /api/me/applications/{id}/code-test/draft`
Autosave. **Body**: `{ language, sourceCode }` (≤ 100 mil caracteres). Código cifrado em repouso.
**200**: `CandidateChallengeView`.
**409 `ALREADY_SUBMITTED`** · **409 `TIME_EXPIRED`** (o prazo venceu e o último rascunho foi submetido).

### `POST /api/me/applications/{id}/code-test/run`
Salva o código e executa contra os **casos visíveis**.
**Body**: `{ language, sourceCode }`.
**200**: `{ results: [{ index, input, expectedOutput, actualOutput, outcome: "PASSED"|"FAILED"|"TIME_LIMIT"|"COMPILE_ERROR"|"RUNTIME_ERROR", diagnostics }], testRunCount, remainingRuns }`.

| HTTP | `code` | Quando |
|---|---|---|
| 422 | `TEST_RUNS_EXHAUSTED` | já usou as 20 execuções (`remainingRuns: 0`); submeter continua possível |
| 409 | `RUN_IN_PROGRESS` | outra execução do mesmo candidato em andamento |
| 503 | `SANDBOX_UNAVAILABLE` | sandbox fora do ar; não consome execução e o código fica salvo |
| 409 | `ALREADY_SUBMITTED` / `TIME_EXPIRED` | como no autosave |

### `POST /api/me/applications/{id}/code-test/submit`
Submissão final, **única** (RN006). Salva o código enviado, grava a submissão e dispara a
correção em segundo plano contra todos os casos, inclusive os ocultos. Falha técnica do sandbox
é reprocessada uma vez; persistindo, a submissão fica `FAILED` e a falha vai para o log.
**Body**: `{ language, sourceCode }`. **200**: `CandidateChallengeView` com `submission.status: "GRADING"`.
**409 `ALREADY_SUBMITTED`** (vem do índice único) · **409 `TIME_EXPIRED`**.

### `POST /api/internal/code-tests/expire` — rotina agendada
Submete os rascunhos com prazo vencido de quem não voltou à tela.
**Header**: `Authorization: Bearer <CRON_SECRET>`; sem a variável configurada a rota fica desligada.
**200**: `{ expired: <quantidade> }`. **401**: segredo ausente ou errado.

---

## Painel de recrutamento — RF07

### `GET /api/recruiter/dashboard`
**Query**: `jobId?` — sem ele, agrega todas as vagas.
**200**:
```json
{
  "jobs": [{ "id": "…", "title": "…", "status": "PUBLISHED",
             "candidatesByStage": [{ "stageType": "RESUME_ANALYSIS", "count": 12 }] }],
  "funnel": {
    "avgTimePerStageHours": [{ "stageType": "RESUME_ANALYSIS", "hours": 4.2 }],
    "advanceRatePerStage": [{ "stageType": "RESUME_ANALYSIS", "rate": 0.65 }],
    "bottleneckStageType": "TECH_INTERVIEW"
  }
}
```
`candidatesByStage` conta só candidaturas em andamento. Métricas por agregação sobre o histórico
de etapas, nunca texto livre. Sem vagas → **200** com `jobs: []`.

### `GET /api/recruiter/jobs/{id}/applications`
**200**: `{ items: [{ id, candidateName, currentStageType, status, matchScore }] }`.

---

## Análise detalhada do candidato — RF08

### `GET /api/recruiter/applications/{id}`
**200**:
```json
{
  "id": "…",
  "candidate": { "name": "…", "email": "…" },
  "professionalProfile": { "...": "mesmo formato de details em GET /api/me/profile" },
  "job": { "id": "…", "title": "…" },
  "currentStage": { "type": "TECH_INTERVIEW", "order": 4 },
  "status": "IN_PROGRESS",
  "evaluations": [
    { "type": "RESUME_MATCH", "score": 72, "justification": { "matched": ["React"], "missing": ["Docker"] } },
    { "type": "CODE_TEST", "score": 80, "justification": { "language": "python", "passed": 4, "total": 5, "compileError": false, "cases": [] } }
  ],
  "externalAccounts": [{ "provider": "GITHUB", "status": "CONNECTED" }],
  "resume": { "id": "…", "originalFilename": "cv.pdf" },
  "codeTest": { "status": "COMPLETED", "...": "ver abaixo" }
}
```
`codeTest.status`:

| Status | Campos |
|---|---|
| `NOT_APPLICABLE` | vaga sem etapa de teste de código |
| `NOT_STARTED` | `challengeTitle` (ou `null` se não configurado) |
| `IN_PROGRESS` | `challengeTitle`, `startedAt`, `deadline` |
| `GRADING` / `FAILED` | `challengeTitle`, `submittedAt`, `submittedBy`, `language` |
| `COMPLETED` | os anteriores + `score`, `passed`, `total`, `cases: [{ index, hidden, outcome }]`, `timeSpentSeconds`, `sourceCode` |

Os casos ocultos aparecem só por índice e resultado, nunca pelo conteúdo.

### `POST /api/recruiter/applications/{id}/decision`
**Body**: `{ decision: "ADVANCE" | "REJECT" }`.
**200**: `{ currentStage: { type, order }, status: "IN_PROGRESS" | "APPROVED" | "REJECTED" }` —
`ADVANCE` na última etapa aprova. Grava o histórico com quem decidiu. **Nenhum score é aceito**:
a rota não tem onde gravá-lo (RN003).
**409 `APPLICATION_CLOSED`**: candidatura já decidida.

---

## Busca e histórico de candidatos — RF09

### `GET /api/recruiter/candidates`
**Query**: `q` (obrigatório) — nome, e-mail ou tecnologia. **400** se vazio.
**200**:
```json
{ "items": [{ "candidateId": "…", "name": "…", "email": "…",
              "applications": [{ "jobId": "…", "jobTitle": "…", "score": 72, "status": "APPROVED" }] }] }
```
Agrupado por candidato (um por e-mail, RN007). `score` pode ser `null`. Nenhum resultado → **200** com `items: []`.

---

## O que não existe, de propósito

- **Nenhuma rota escreve ou altera `Evaluation` ou `JobMatch`** (RN003). Score só nasce por
  inserção nos fluxos automáticos; o banco ainda bloqueia `UPDATE` por trigger.
- **E-mail de feedback ao candidato (RN005)** e convite por e-mail: sem provedor ligado
  ([D6](../../001-portal-candidatura/ers-divergences.md)). "Convidar para nova vaga" é só um link na tela.

## Divergências corrigidas nesta revisão

| Antes (documentado) | Como o sistema faz |
|---|---|
| Sessão em banco | Sessão JWT (D10) |
| `POST /api/auth/register` → 409 sem código | `409 REGISTRATION_FAILED` |
| `POST /api/me/resume` → `{ id, originalFilename, sizeBytes, uploadedAt }` | também devolve `draft` (spec 007) |
| `GET/PATCH /api/me/profile` só dados básicos | inclui o perfil profissional em `details` |
| `PUT …/stages` → `422 EMPTY_PIPELINE` | não existe: array vazio é aceito, a publicação recusa |
| `publish` → `missing` sem o teste de código | `missing` pode conter `codeTest` |
| `PATCH …/jobs/{id}` → 404 se a vaga "não pertence ao recrutador" | não há dono por recrutador: organização única |
| `GET …/applications/{id}` → `codeTest: NOT_AVAILABLE_YET` fixo, 403 por dono | `codeTest` com cinco estados; sem 403 por dono |
| Teste de código "nenhuma rota existe" | 6 rotas de candidato, 4 de catálogo e 1 interna |
| Sem documentação | `GET /api/recruiter/jobs/{id}`, `GET …/jobs/{id}/applications`, `GET /api/auth/post-login`, LGPD |
