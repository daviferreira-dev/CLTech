# Data Model — Portal de Candidatura (Sprint 1)

**Data**: 2026-09-12
**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

Este é o modelo relacional completo previsto no escopo da sprint: comporta as Sprints 2 e
3 (FR-027), mas só parte dele tem comportamento agora.

**Legenda de escopo**
- 🟢 **Ativa** — criada e usada nesta sprint.
- 🟡 **Modelada** — tabela criada e migrada, sem escrita funcional nesta sprint.

---

## Visão geral

```text
User 1──1 Candidate 1──* Application *──1 Job
 │                │                │         │
 │                ├──* ExternalAccount        ├──* ProcessStage ──* Challenge 🟡
 │                ├──0..1 GithubProfile       │
 │                ├──* Resume                 │
 │                └──* JobMatch 🟡 ───────────┘
 │
 └──* Session / Account (Auth.js)

Application ──* ApplicationStageHistory ──1 ProcessStage
Application ──* Evaluation  🟡
Application ──* CodeSubmission 🟡 ──1 Evaluation 🟡
Application ──* CodeDraft 🟡 ──1 Challenge 🟡
```

**14 entidades** — 9 ativas (🟢) e 5 modeladas (🟡). `Account` e `Session` são do adapter
do Auth.js e não contam como entidades de domínio.

---

## Entidades

### User 🟢

Identidade de acesso. Uma linha por pessoa que entra na plataforma.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `email` | text | **único, obrigatório**, normalizado para minúsculas. Chave de identidade (RN007). Em texto claro por ser indexável — ver R4. |
| `emailVerified` | timestamp? | preenchido por provedor externo ou fluxo de verificação |
| `name` | text | obrigatório |
| `passwordHash` | text? | Argon2id. Nulo quando a conta só existe via OAuth (FR-007) |
| `role` | enum | `CANDIDATE` \| `RECRUITER` \| `ADMIN`. Default `CANDIDATE` (FR-001) |
| `createdAt` / `updatedAt` | timestamp | |

**Regras**
- Um usuário tem exatamente um papel (suposição da spec).
- Cadastro com e-mail já existente é recusado sem revelar a existência da conta (FR-004).
- Login via provedor externo com e-mail já cadastrado **vincula** em vez de criar (FR-003).

---

### Account 🟢 · Session 🟢 (Auth.js)

Tabelas do adapter de autenticação. `Account` guarda o vínculo com GitHub/LinkedIn
(`provider`, `providerAccountId`, tokens); `Session` guarda as sessões ativas em banco,
permitindo revogação (R2).

`Account` é a tabela que torna FR-003 possível: o mesmo `User` pode ter N provedores.

---

### Candidate 🟢

Dados pessoais e profissionais de quem se candidata.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `userId` | uuid | **único**, FK → User. Relação 1:1 |
| `phone` | text? | **cifrado** AES-256-GCM (R4) |
| `city` | text? | |
| `state` | text? | |
| `createdAt` / `updatedAt` | timestamp | |

Nome e e-mail vivem em `User` para não duplicar a identidade. A unicidade de perfil por
e-mail (RN007) é consequência direta da relação 1:1 com `User`.

---

### ExternalAccount 🟢

Vínculo do candidato com uma origem externa de dados. Distinto de `Account`: aquela é de
**autenticação**, esta é de **coleta de portfólio**.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `candidateId` | uuid | FK → Candidate |
| `provider` | enum | `GITHUB` \| `LINKEDIN` \| `LATTES` |
| `externalUsername` | text? | |
| `url` | text? | usado pelo Lattes, que é link manual |
| `status` | enum | `PENDING` \| `CONNECTED` \| `UNAVAILABLE` \| `DISCONNECTED` |
| `unavailableReason` | text? | motivo legível: perfil privado, 404, rate limit, timeout (FR-012) |
| `lastSyncedAt` | timestamp? | |

**Restrição**: único por (`candidateId`, `provider`).

**Transições de estado**

```text
(inexistente) ──conectar──> PENDING ──coleta ok────> CONNECTED
                              │                          │
                              └──coleta falha──> UNAVAILABLE
                                                    │
UNAVAILABLE ──nova tentativa (FR-013)──> PENDING ───┘

CONNECTED | UNAVAILABLE ──desconectar (FR-010)──> DISCONNECTED
```

`UNAVAILABLE` **nunca** bloqueia candidatura (FR-012, SC-008).

---

### GithubProfile 🟢

Snapshot dos dados coletados do GitHub (R6). Um por candidato.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `candidateId` | uuid | **único**, FK → Candidate |
| `publicRepoCount` | int | |
| `languages` | jsonb | `[{ "name": "TypeScript", "bytes": 130422, "share": 0.41 }]` |
| `activityLast90Days` | int | número de eventos públicos |
| `followers` | int | |
| `collectedAt` | timestamp | obrigatório — a interface exibe a data do snapshot |

Substituído inteiro a cada nova coleta. Não é consultado ao vivo (RNF03).

---

### Resume 🟢

Currículo anexado. Histórico preservado: FR-015 exige saber qual versão valia em cada
candidatura.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `candidateId` | uuid | FK → Candidate |
| `storageKey` | text | caminho no bucket privado |
| `originalFilename` | text | |
| `mimeType` | text | `application/pdf` ou `...wordprocessingml.document` |
| `sizeBytes` | int | ≤ 5.242.880 (FR-014) |
| `isCurrent` | boolean | apenas um `true` por candidato |
| `uploadedAt` | timestamp | |
| `parseStatus` | enum | `NOT_PARSED` \| `PENDING` \| `PARSED` \| `FAILED`. Sempre `NOT_PARSED` nesta sprint 🟡 |

**Validação no servidor** (autoridade): extensão + MIME + tamanho + magic number (R5).
Arquivo recusado não substitui o `isCurrent` anterior (FR-014).

---

### Job 🟢

Vaga publicada pela 3aq.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `title` | text | obrigatório |
| `description` | text | |
| `company` | text | |
| `location` | text | |
| `workMode` | enum | `REMOTE` \| `HYBRID` \| `ONSITE` |
| `seniority` | enum | `INTERN` \| `JUNIOR` \| `MID` \| `SENIOR` |
| `technologies` | text[] | usado no filtro (FR-019) e, na Sprint 2, como base do score (RN002) |
| `minimumRequirements` | text | obrigatório para publicar (RN002) |
| `status` | enum | `DRAFT` \| `PUBLISHED` \| `CLOSED` |
| `createdById` | uuid | FK → User (papel RECRUITER/ADMIN) |
| `publishedAt` | timestamp? | |

**Regra (RN002)**: `status = PUBLISHED` exige `technologies` não vazio e
`minimumRequirements` preenchido. Nesta sprint as vagas são semeadas (seed); o construtor
visual é RF04, da Sprint 2.

Despublicar não remove candidaturas existentes (edge case da spec).

---

### ProcessStage 🟢

Etapa ordenada do processo seletivo de uma vaga.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `jobId` | uuid | FK → Job |
| `type` | enum | `RESUME_ANALYSIS` \| `CODE_TEST` \| `GITHUB_ANALYSIS` \| `HR_INTERVIEW` \| `TECH_INTERVIEW` \| `FINAL_OFFER` |
| `order` | int | posição no pipeline |
| `config` | jsonb | parâmetros da etapa. Vazio nesta sprint — contrato abaixo |

**Restrição**: único por (`jobId`, `order`). Toda vaga publicada tem ≥ 1 etapa.

**Contrato do `config` por tipo de etapa** (Sprint 3 — fixado agora porque o RF05-A1 e o
RF06-E1 dependem dele; ver [D5](./ers-divergences.md#d5)):

```jsonc
// type = CODE_TEST
{
  "challengeId": "uuid",      // qual desafio aplicar
  "timeLimitMinutes": 60,     // RF05-A1: esgotado, envia o último CodeDraft
  "languages": ["javascript", "python"],
  "difficulty": "MID",
  "maxTestRuns": 20           // D5: teto de execuções antes da submissão final
}
// demais tipos: {} nesta versão
```

---

### Application 🟢

Inscrição de um candidato em uma vaga. Entidade central.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `candidateId` | uuid | FK → Candidate |
| `jobId` | uuid | FK → Job |
| `resumeId` | uuid | FK → Resume — congela qual currículo valia na inscrição (FR-015) |
| `currentStageId` | uuid | FK → ProcessStage |
| `status` | enum | `IN_PROGRESS` \| `APPROVED` \| `REJECTED` \| `WITHDRAWN` |
| `matchScore` | int? | **sempre nulo nesta sprint** (FR-026) |
| `matchScoreStatus` | enum | `NOT_CALCULATED` \| `PENDING` \| `CALCULATED` \| `FAILED`. Default `NOT_CALCULATED` |
| `appliedAt` | timestamp | |
| `updatedAt` | timestamp | |

**Restrição crítica**: índice único em (`candidateId`, `jobId`) — é o que garante FR-022 e
SC-003 mesmo com envio duplo simultâneo (a segunda inserção falha no banco, não no
código).

**Pré-condições para criar** (FR-021, FR-024): usuário autenticado, papel `CANDIDATE`,
vaga `PUBLISHED`, candidato com `Resume.isCurrent = true`.

---

### ApplicationStageHistory 🟢

Registro append-only de cada mudança de etapa (FR-029).

| Campo | Tipo |
|---|---|
| `id` | uuid |
| `applicationId` | uuid FK |
| `stageId` | uuid FK → ProcessStage |
| `enteredAt` | timestamp |
| `exitedAt` | timestamp? |
| `decidedByUserId` | uuid? FK → User — nulo quando a transição é automática |

Nunca sofre update destrutivo: sair de uma etapa preenche `exitedAt` e insere a linha da
etapa seguinte.

---

### JobMatch 🟡

Compatibilidade pré-calculada entre um candidato e uma vaga **à qual ele ainda não se
candidatou**. Existe porque o RF03 (passo 4 do fluxo principal) exige exibir o percentual
de match na *listagem* de vagas — ver [D3](./ers-divergences.md#d3).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `candidateId` | uuid | FK → Candidate |
| `jobId` | uuid | FK → Job |
| `score` | int | 0–100 |
| `justification` | jsonb | competências encontradas × exigidas (Princípio III) |
| `computedAt` | timestamp | |
| `staleSince` | timestamp? | marcado quando o currículo ou a vaga muda |

**Restrição**: único por (`candidateId`, `jobId`).

**Por que é entidade separada de `Application.matchScore`**: são momentos diferentes.
`JobMatch` é orientação ao candidato *antes* de decidir se candidatar e pode ser recalculado
à vontade. `Application.matchScore` é o score **congelado** da inscrição, sujeito à RN003.
Fundi-los tornaria um score imutável dependente de dado volátil.

**Nunca é calculado no caminho da requisição** — a listagem apenas lê. O RNF03 (3 s com 50
usuários) não sobrevive a um cálculo de NLP por vaga por pageview. O recálculo é assíncrono,
disparado por troca de currículo ou edição da vaga.

Vazia na Sprint 1: nenhum match é exibido (FR-026).

---

### Challenge 🟡

Enunciado do teste técnico e seus casos de teste. Referenciada por
`CodeSubmission.challengeId` desde a Sprint 1 — sem ela a constraint da RN006 não migra.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `title` | text | |
| `statement` | text | enunciado em markdown (RF05 passo 3) |
| `languages` | text[] | linguagens aceitas |
| `difficulty` | enum | `EASY` \| `MID` \| `HARD` |
| `testCases` | jsonb | `[{ "input": "...", "expectedOutput": "...", "hidden": true }]` |
| `timeLimitSeconds` | int | teto por execução; ≤ 10 por imposição do RNF06 |
| `createdAt` | timestamp | |

**`testCases` nunca é exposto ao candidato**: casos com `hidden: true` não saem do servidor
nem no enunciado nem no resultado da execução de teste. Do contrário o teste vira cópia.

**Mesmos casos de teste para todos os candidatos da mesma vaga** — exigência do Princípio II
(*"candidatos de uma mesma vaga MUST ser pontuados pelo mesmo conjunto de critérios e casos
de teste"*).

---

### CodeDraft 🟡

Rascunho com autosave do código em escrita. Existe porque o **RF05-A1** — *"tempo esgotado
→ envia o último estado salvo para correção"* — é impossível sem persistir o estado
intermediário. Ver [D5](./ers-divergences.md#d5).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `applicationId` | uuid | FK → Application |
| `challengeId` | uuid | FK → Challenge |
| `language` | text | |
| `sourceCode` | text | **cifrado** em repouso |
| `testRunCount` | int | execuções de teste já consumidas (teto em `ProcessStage.config.maxTestRuns`) |
| `startedAt` | timestamp | início da tentativa — base para o `timeLimitMinutes` |
| `updatedAt` | timestamp | último autosave |

**Restrição**: único por (`applicationId`, `challengeId`).

Sobrescrito a cada autosave (não é histórico). Ao submeter, o conteúdo é copiado para
`CodeSubmission` e o rascunho perde a função — mas é **preservado**, não apagado, porque é a
evidência de que a submissão automática por tempo esgotado refletiu o trabalho real.

Não viola a RN006: rascunho não é submissão. A tentativa única incide sobre `CodeSubmission`.

---

### Evaluation 🟡

Resultado automático somente-leitura. Criada vazia nesta sprint (FR-027/FR-028).

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `applicationId` | uuid | FK → Application |
| `type` | enum | `RESUME_MATCH` \| `GITHUB_ANALYSIS` \| `CODE_TEST` |
| `score` | int | 0–100, **imutável** |
| `justification` | jsonb | competências encontradas x exigidas (RN001/III) |
| `version` | int | reprocessamento insere nova linha com `version + 1` |
| `createdAt` | timestamp | |

**Imutabilidade (Princípio II)** — três barreiras:
1. Nenhuma rota de update é exposta.
2. Correção só por nova linha versionada; a anterior permanece.
3. Trigger `BEFORE UPDATE` no Postgres levanta exceção — protege até contra acesso
   direto ao banco.

A leitura corrente é a linha de maior `version` por (`applicationId`, `type`).

A decisão humana de avançar ou reprovar mora em `Application.status` e em
`ApplicationStageHistory.decidedByUserId`, **nunca** neste registro.

---

### CodeSubmission 🟡

Submissão do teste técnico. Criada vazia nesta sprint; comportamento é da Sprint 3.

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `applicationId` | uuid | FK → Application |
| `challengeId` | uuid | FK → Challenge (Sprint 3) |
| `language` | text | |
| `sourceCode` | text | cifrado em repouso |
| `submittedAt` | timestamp | |
| `executionStatus` | enum | `QUEUED` \| `RUNNING` \| `COMPLETED` \| `TIMEOUT` \| `SECURITY_VIOLATION` \| `ERROR` |
| `retryCount` | int | default `0`, **máximo 1** — RF06-E1 |
| `submittedBy` | enum | `CANDIDATE` \| `TIME_EXPIRED` — RF05-A1 |
| `evaluationId` | uuid? | FK → Evaluation |

**Restrição já modelada**: único por (`applicationId`, `challengeId`) — implementa RN006
(tentativa única) no banco, não em código.

**`retryCount`** implementa o RF06-E1: *"se o sandbox falhar por motivo técnico (não
atribuível ao candidato), o sistema reprocessa automaticamente a submissão até uma vez
antes de notificar a equipe técnica"*. Só `ERROR` autoriza retentativa — `TIMEOUT` e
`SECURITY_VIOLATION` são resultado do candidato e são **finais**, sob pena de dar segunda
chance a quem estourou o limite (violaria a RN006 na prática).

---

## Regras transversais

| Regra | Onde é garantida |
|---|---|
| RN007 — um perfil por e-mail | `User.email` único + `Candidate.userId` único |
| FR-022 — sem candidatura duplicada | índice único (`candidateId`, `jobId`) |
| RN006 — tentativa única de teste | índice único (`applicationId`, `challengeId`) |
| Princípio II — score imutável | ausência de rota de update + versionamento + trigger |
| Princípio I — cifra em repouso | `Candidate.phone`, `Resume` (conteúdo), `CodeSubmission.sourceCode`, `CodeDraft.sourceCode` |
| Princípio II — mesmos critérios para todos | `Challenge.testCases` é da vaga, não do candidato |
| RF06-E1 — uma retentativa técnica | `CodeSubmission.retryCount ≤ 1`, só sobre `ERROR` |
| FR-017 — acesso por papel | verificação server-side em toda leitura de `Resume` e `GithubProfile` |
| FR-029 — rastro temporal | `createdAt`/`updatedAt` + `ApplicationStageHistory` |

## Dados de seed (Sprint 1)

Para demonstrar as histórias P1 sem o construtor de vagas (RF04, Sprint 2):
- 1 usuário `RECRUITER` e 1 `ADMIN`.
- 5 vagas `PUBLISHED` cobrindo as três modalidades e as quatro senioridades, para exercitar
  os filtros do FR-019.
- Cada vaga com pipeline de 4 a 6 `ProcessStage`, começando por `RESUME_ANALYSIS`.
- 1 vaga `CLOSED` com candidatura pré-existente, para validar o edge case de vaga
  despublicada.
