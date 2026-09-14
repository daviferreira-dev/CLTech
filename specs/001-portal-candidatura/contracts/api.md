# API Contracts — Portal de Candidatura (Sprint 1)

**Data**: 2026-09-12 · **Spec**: [../spec.md](../spec.md) · **Modelo**: [../data-model.md](../data-model.md)

Contratos HTTP expostos pela aplicação nesta sprint. Base: `/api`.

## Convenções

- Corpo de requisição e resposta em JSON, exceto o upload de currículo
  (`multipart/form-data`).
- Autenticação por cookie de sessão (Auth.js, sessão em banco).
- Erros seguem um formato único:
  ```json
  { "error": { "code": "RESUME_REQUIRED", "message": "Anexe um currículo antes de se candidatar." } }
  ```
- Códigos usados: `400` validação, `401` não autenticado, `403` sem permissão,
  `404` inexistente, `409` conflito de estado, `413` arquivo grande demais,
  `415` formato não suportado, `422` regra de negócio violada.
- **Toda rota que lê dado pessoal de terceiro verifica o papel no servidor** (FR-017).
  Nenhuma decisão de autorização é tomada apenas no cliente.

---

## Autenticação — RF01

### `POST /api/auth/register`
Cria conta com papel `CANDIDATE` (FR-001).

**Body**: `{ name, email, password }` — senha com mínimo de 8 caracteres.

**201**: `{ user: { id, name, email, role } }` + sessão criada.
**409**: e-mail já cadastrado. A mensagem é genérica ("Não foi possível criar a conta com
esses dados") para não permitir enumeração de usuários (FR-004).

### `POST /api/auth/callback/credentials` · `GET /api/auth/signin/{github|linkedin}` · `POST /api/auth/signout`
Rotas geridas pelo Auth.js (FR-002, FR-005). O provedor externo com e-mail já existente
vincula à conta atual em vez de criar outra (FR-003).

**Redirecionamento pós-login (FR-006)**: `CANDIDATE` → `/vagas`;
`RECRUITER`/`ADMIN` → `/recrutamento`. Decidido no servidor a partir de `session.user.role`.

### `GET /api/auth/session`
**200**: `{ user: { id, name, email, role } } | null`

---

## Perfil do candidato — RF02

Todas exigem sessão com papel `CANDIDATE`; um candidato só acessa o próprio recurso.

### `GET /api/me/profile`
**200**:
```json
{
  "name": "…", "email": "…", "phone": "…", "city": "…", "state": "…",
  "externalAccounts": [
    { "provider": "GITHUB", "status": "CONNECTED", "externalUsername": "…", "lastSyncedAt": "…" },
    { "provider": "LINKEDIN", "status": "UNAVAILABLE", "unavailableReason": "Perfil privado" }
  ],
  "githubProfile": { "publicRepoCount": 23, "languages": [...], "activityLast90Days": 140, "collectedAt": "…" },
  "resume": { "id": "…", "originalFilename": "cv.pdf", "sizeBytes": 214003, "uploadedAt": "…" }
}
```
`phone` é decifrado no servidor (R4). `githubProfile` vem `null` quando a coleta não
ocorreu ou falhou — o cliente exibe "Indisponível" (FR-012).

### `PATCH /api/me/profile`
**Body**: `{ name?, phone?, city?, state? }` (FR-009). **200** com o perfil atualizado.

### `POST /api/me/external-accounts`
**Body**: `{ provider: "GITHUB"|"LINKEDIN"|"LATTES", url? }` (FR-010).

**202**: `{ status: "PENDING" }` — a coleta roda fora do request (R6). O cliente faz poll
do `GET /api/me/profile`.
**Nunca retorna 5xx por falha do provedor externo**: a falha vira `status: "UNAVAILABLE"`
com motivo (FR-012).

### `DELETE /api/me/external-accounts/{provider}`
**204**. Vínculo passa a `DISCONNECTED` e os dados coletados deixam de ser exibidos.

### `POST /api/me/external-accounts/{provider}/sync`
Nova tentativa de coleta para um vínculo `UNAVAILABLE` (FR-013). **202** `{ status: "PENDING" }`.

### `POST /api/me/resume`
`multipart/form-data`, campo `file` (FR-014).

Validação **no servidor**: extensão, MIME, tamanho ≤ 5 MB e magic number (`%PDF` /
`PK\x03\x04`).

**201**: `{ id, originalFilename, sizeBytes, uploadedAt }`
**413**: arquivo acima de 5 MB. **415**: formato não suportado.
Em ambos os casos o currículo anterior permanece vigente.

### `GET /api/resumes/{id}/download`
**200**: redirect para URL assinada de curta duração, gerada só após a checagem de
permissão (R5).

**Autorização (FR-017)**: o próprio candidato dono do arquivo, ou papel `RECRUITER`/`ADMIN`.
Qualquer outro caso → **403**. *Esta rota tem teste automatizado obrigatório
(Princípio I).*

---

## Vagas e candidaturas — RF03

### `GET /api/jobs` — público
**Query**: `workMode`, `seniority`, `technology`, `q`, `page`, `pageSize` (FR-019).

**200**:
```json
{
  "items": [{ "id": "…", "title": "…", "company": "…", "location": "…",
              "workMode": "REMOTE", "seniority": "MID", "technologies": ["React", "Node"] }],
  "page": 1, "pageSize": 20, "total": 5
}
```
Lista vazia é resposta **200** com `items: []`, não 404 — o cliente mostra a orientação de
ampliar a busca (FR-019).

Retorna somente vagas `PUBLISHED`.

### `GET /api/jobs/{id}` — público
**200**: vaga + `stages: [{ type, order }]` (FR-020). **404** se não existir ou não estiver
publicada, **exceto** para um candidato já inscrito nela, que continua enxergando a vaga
da sua candidatura.

### `POST /api/jobs/{id}/apply`
Exige sessão com papel `CANDIDATE` (FR-021).

**201**: `{ applicationId, currentStage: { type, order }, appliedAt, matchScoreStatus: "NOT_CALCULATED" }`

**Erros de regra de negócio**:
| Código | Situação | Requisito |
|---|---|---|
| `401` | não autenticado — o cliente leva ao login e retorna à vaga | FR-023 |
| `422 RESUME_REQUIRED` | candidato sem currículo vigente | FR-024 |
| `409 ALREADY_APPLIED` | já existe candidatura; resposta inclui o status atual | FR-022 |
| `422 JOB_NOT_OPEN` | vaga não está `PUBLISHED` | — |

O `409` é derivado da violação do índice único (`candidateId`, `jobId`), não de um
`SELECT` prévio — é isso que torna o envio simultâneo seguro (SC-003). *Tem teste
automatizado obrigatório.*

### `GET /api/me/applications`
**200**: lista com `{ applicationId, job: { id, title, company }, appliedAt, currentStage, status, matchScoreStatus }` (FR-025).

---

## Fora do escopo desta sprint

Rotas modeladas no domínio mas **não expostas** agora:

- Construtor de vagas do recrutador (RF04) — Sprint 2.
- Painel e análise detalhada do candidato (RF07, RF08) — Sprint 2.
- Teste de código e correção automática (RF05, RF06) — Sprint 3.
- **Nenhuma rota de escrita ou atualização de `Evaluation` existe, em nenhuma sprint**
  (Princípio II).
