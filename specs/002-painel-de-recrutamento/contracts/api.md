# API Contracts — Painel de Recrutamento e Triagem Automática (Sprint 2)

**Data**: 2026-10-16 · **Spec**: [../spec.md](../spec.md) · **Modelo**: [../data-model.md](../data-model.md)

Contratos novos e extensões aos contratos da Sprint 1
([../../001-portal-candidatura/contracts/api.md](../../001-portal-candidatura/contracts/api.md)).
Mesmas convenções: JSON (exceto upload), cookie de sessão, formato único de erro,
`401`/`403`/`404`/`409`/`422` com o mesmo sentido já estabelecido.

**Toda rota sob `/api/recruiter/`** exige sessão com papel `RECRUITER` ou `ADMIN`,
verificado no servidor (`requireRole`, já existente desde T013 da Sprint 1) — `403` para
qualquer outro papel, `401` sem sessão.

---

## Extensões a rotas existentes

### `GET /api/jobs` — público (Sprint 1, estendida)

**Mudança**: quando a requisição tem sessão de candidato autenticado, cada item passa a
incluir `matchScore`.

**200**:
```json
{
  "items": [{
    "id": "…", "title": "…", "company": "…", "location": "…",
    "workMode": "REMOTE", "seniority": "MID", "technologies": ["React", "Node"],
    "matchScore": { "value": 72, "status": "CALCULATED" }
              // ou { "status": "NEEDS_RESUME" } — sem currículo vigente (FR-036)
              // ou omitido por completo — sem sessão (FR-035)
  }],
  "page": 1, "pageSize": 20, "total": 5
}
```

Nunca calcula em tempo de requisição — lê `JobMatch` como está (FR-034, R15 da Sprint 1,
[D3](../../001-portal-candidatura/ers-divergences.md#d3)).

### `GET /api/jobs/{id}` — público (Sprint 1, estendida)

**Mudança**: quando autenticado, inclui a justificativa completa do match com aquela vaga.

**200** (campo novo):
```json
{
  "matchScore": {
    "value": 72,
    "status": "CALCULATED",
    "matched": ["React", "Node"],
    "missing": ["Docker"]
  }
}
```

---

## Triagem automática — RN001, FR-032..037

Sem rota própria — acontece como efeito colateral de rotas já existentes.

- `POST /api/me/resume` (Sprint 1): depois de validar e gravar o arquivo, extrai o texto
  (R13), grava `extractedText` + `parseStatus`, e dispara o recálculo de todas as
  `JobMatch` do candidato (R12, gatilho 1 do `data-model.md`). A resposta **201** não muda
  de formato; o recálculo é fire-and-forget, não bloqueia a resposta do upload.
- `POST /api/me/external-accounts/github/sync` (Sprint 1): depois de sincronizar, dispara o
  mesmo recálculo (gatilho 2).
- `POST /api/jobs/{id}/apply` (Sprint 1): dentro da mesma transação que cria a `Application`,
  grava `Evaluation(RESUME_MATCH)` sempre e `Evaluation(GITHUB_ANALYSIS)` quando aplicável
  (R14). A resposta **201** ganha o campo `matchScoreStatus: "CALCULATED"` no lugar do
  `"NOT_CALCULATED"` fixo da Sprint 1.

---

## Construtor de vagas — RF04

### `POST /api/recruiter/jobs`

Cria vaga como `DRAFT` (FR-038).

**Body**: `{ title, description, company, location, workMode, seniority, technologies: string[], minimumRequirements }`

**201**: `{ id, status: "DRAFT", ... }`

### `PATCH /api/recruiter/jobs/{id}`

Edita uma vaga (FR-038).

**Body**: mesmos campos de criação, todos opcionais.

**200**: vaga atualizada.
**409 `JOB_LOCKED`**: tentativa de alterar `technologies` ou `minimumRequirements` numa vaga
`PUBLISHED` (FR-041). Os demais campos (`title`, `description`, `location`) aceitam edição
mesmo publicada.
**404**: vaga não existe ou não pertence a este recrutador/organização.

### `PUT /api/recruiter/jobs/{id}/stages`

Substitui o conjunto inteiro de etapas, já ordenado (FR-039, FR-042, R16).

**Body**: `{ stages: [{ type: "RESUME_ANALYSIS" | "CODE_TEST" | "GITHUB_ANALYSIS" | "HR_INTERVIEW" | "TECH_INTERVIEW" | "FINAL_OFFER", config?: object }] }`
— a ordem no array é a ordem do pipeline.

**200**: `{ stages: [{ id, type, order }] }`
**409 `JOB_LOCKED`**: vaga já `PUBLISHED` (FR-041).
**422 `EMPTY_PIPELINE`**: array vazio — permitido salvar como rascunho, mas bloqueia
publicação depois (não é erro aqui, só não publica sem isso).

### `POST /api/recruiter/jobs/{id}/publish`

Transição `DRAFT → PUBLISHED` (FR-040).

**200**: `{ id, status: "PUBLISHED", publishedAt }`. Dispara o gatilho 3 do `data-model.md`
(cria `JobMatch` inicial para candidatos elegíveis).

**422 `INCOMPLETE_JOB`**: faltam tecnologias, requisitos mínimos ou nenhuma etapa
configurada. Resposta inclui quais campos faltam:
```json
{ "error": { "code": "INCOMPLETE_JOB", "message": "…", "missing": ["technologies", "stages"] } }
```
**409**: vaga já está `PUBLISHED` (não é uma operação idempotente — publicar de novo não
tem efeito e é tratado como conflito).

### `GET /api/recruiter/jobs`

Lista as vagas do recrutador, com status, para a tela de gestão (`DRAFT` e `PUBLISHED`
juntas, ao contrário de `GET /api/jobs` que só mostra `PUBLISHED`).

**200**: `{ items: [{ id, title, status, candidateCount, createdAt }] }`

---

## Painel de recrutamento — RF07

### `GET /api/recruiter/dashboard`

**Query**: `jobId?` — quando ausente, agrega todas as vagas do recrutador (FR-044).

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
Métricas calculadas por agregação SQL sobre `ApplicationStageHistory` (R15) — nunca
geradas como texto livre ([D4](../../001-portal-candidatura/ers-divergences.md#d4)).

Lista de vagas vazia (`jobs: []`) é resposta **200**, não erro — o cliente mostra a
orientação de criar a primeira vaga (FR-046).

---

## Análise detalhada do candidato — RF08

### `GET /api/recruiter/applications/{id}`

**200**:
```json
{
  "candidate": { "name": "…", "email": "…" },
  "job": { "id": "…", "title": "…" },
  "currentStage": { "type": "TECH_INTERVIEW", "order": 4 },
  "evaluations": [
    { "type": "RESUME_MATCH", "score": 72, "justification": { "matched": [...], "missing": [...] } },
    { "type": "GITHUB_ANALYSIS", "score": 80, "justification": { ... } }
  ],
  "externalAccounts": [{ "provider": "GITHUB", "status": "CONNECTED" }],
  "resume": { "id": "…", "originalFilename": "cv.pdf" },
  "codeTest": { "status": "NOT_AVAILABLE_YET" }
              // ou "PENDING" quando a etapa existe no pipeline mas o candidato não concluiu
}
```
`codeTest.status: "NOT_AVAILABLE_YET"` é fixo nesta sprint (FR-048) — a capacidade não
existe até a Sprint 3, independente do pipeline da vaga incluir `CODE_TEST`.

**403**: candidatura não pertence a nenhuma vaga deste recrutador (quando a autorização for
por organização/dono da vaga, não só por papel).
**404**: candidatura inexistente.

### `POST /api/recruiter/applications/{id}/decision`

Registra avançar/reprovar (FR-049).

**Body**: `{ decision: "ADVANCE" | "REJECT" }`

**200**: `{ currentStage: { type, order }, status: "IN_PROGRESS" | "APPROVED" | "REJECTED" }`
— `ADVANCE` na última etapa (`FINAL_OFFER`) grava `status: "APPROVED"`.

Grava em `ApplicationStageHistory` com `decidedByUserId` (FR-049). **Nenhum campo de score é
aceito neste body** — tentar enviar `score` é ignorado silenciosamente, não é nem validado,
porque a rota não tem onde colocá-lo (FR-050, Princípio II).

**409**: candidatura já está `APPROVED`/`REJECTED`/`WITHDRAWN` — decisão só se aplica a
`IN_PROGRESS`.

---

## Busca e histórico de candidatos — RF09

### `GET /api/recruiter/candidates`

**Query**: `q` — busca por nome, e-mail ou tecnologia (FR-051).

**200**:
```json
{
  "items": [{
    "candidateId": "…", "name": "…", "email": "…",
    "applications": [
      { "jobId": "…", "jobTitle": "…", "score": 72, "status": "APPROVED" },
      { "jobId": "…", "jobTitle": "…", "score": 45, "status": "REJECTED" }
    ]
  }]
}
```
Agrupado por candidato único, por e-mail (FR-052, RN007). Lista vazia é **200** com
`items: []` — o cliente mostra "nenhum candidato encontrado" (FR-053).

---

## Fora do escopo desta sprint

- Teste de código e correção automática (RF05, RF06) — Sprint 3. Nenhuma rota de execução
  existe.
- Envio de e-mail de convite (RF09, "convidar candidato") — sem provedor transacional
  ligado ainda ([D6](../../001-portal-candidatura/ers-divergences.md#d6)); "convidar" é só
  um link no cliente para o recrutador compartilhar manualmente.
- **Nenhuma rota de escrita ou atualização de `Evaluation`/`JobMatch` existe, em nenhuma
  sprint** (Princípio II) — reforça o que já valia desde a Sprint 1.
