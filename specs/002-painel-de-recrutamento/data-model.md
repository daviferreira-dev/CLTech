# Data Model — Painel de Recrutamento e Triagem Automática (Sprint 2)

**Data**: 2026-10-16
**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)
**Modelo completo da Sprint 1**: [../001-portal-candidatura/data-model.md](../001-portal-candidatura/data-model.md)

Nenhuma entidade nova nesta sprint — as 14 já existem desde a Sprint 1, modeladas
antecipadamente (FR-027). Este documento cobre só o que muda: uma coluna nova e quatro
entidades que passam de 🟡 **Modelada** para 🟢 **Ativa**.

---

## Coluna nova

### `Resume.extractedText`

| Campo | Tipo | Regras |
|---|---|---|
| `extractedText` | text? | **cifrado** AES-256-GCM (mesmo padrão do arquivo, R4 da Sprint 1). `null` quando a extração falhou ou ainda não rodou. |

Preenchido no upload (`POST /api/me/resume`), junto com `Resume.parseStatus` passando a ser
escrito de fato: `NOT_PARSED` (nunca mais usado a partir desta sprint — todo upload novo
tenta extrair) → `PARSED` (sucesso) ou `FAILED` (extração falhou, texto `null`). Ver R13.

Migração: `ALTER TABLE "Resume" ADD COLUMN "extractedText" TEXT;` — aditiva, não destrutiva,
currículos já existentes ficam com `extractedText = null` e `parseStatus = NOT_PARSED` até
serem reenviados (não há reprocessamento em lote nesta sprint).

---

## Entidades que passam de 🟡 Modelada para 🟢 Ativa

### Job — transição `DRAFT → PUBLISHED` agora alcançável pelo recrutador

Na Sprint 1, só o seed criava `Job` direto como `PUBLISHED`. Nesta sprint:

```text
(inexistente) ──criar (FR-038)──> DRAFT ──publicar (FR-040)──> PUBLISHED
                                     │                              │
                                     └──editar (FR-038, FR-039)─────┘
                                        (livre em DRAFT)             │
                                                                      X  edição bloqueada
                                                                         (FR-041)
```

**Regra nova (FR-041, corte do RF04-A2 — ver [D7](../001-portal-candidatura/ers-divergences.md#d7)
e a seção Assumptions de `spec.md`)**: uma vez `PUBLISHED`, `technologies`,
`minimumRequirements` e as `ProcessStage` associadas ficam travadas. Os demais campos
(`title`, `description`, `location`) continuam editáveis — não afetam score nem pipeline.

**Regra mantida (RN002)**: publicar exige `technologies` não vazio, `minimumRequirements`
preenchido e ≥ 1 `ProcessStage`.

### ProcessStage — criada e reordenada pelo recrutador, não só pelo seed

Mesma tabela e mesmas regras da Sprint 1 (único por `(jobId, order)`). O que muda é quem
escreve: `PUT /api/recruiter/jobs/{id}/stages` substitui o conjunto inteiro de etapas de uma
vaga `DRAFT` (FR-039, FR-042) — sempre uma reescrita completa e reordenada, nunca um PATCH
parcial de uma etapa isolada, para que a restrição de `order` único nunca fique
temporariamente inconsistente.

### JobMatch — efetivamente calculada (encerra o 🟡 da Sprint 1)

| Campo | Mudança nesta sprint |
|---|---|
| `score` | passa a ser escrito pelo algoritmo de R12, em vez de a tabela ficar vazia |
| `justification` | `{ matched: string[], missing: string[] }` (R12) |
| `staleSince` | passa a ser efetivamente usado como gatilho de recálculo |

**Gatilhos de recálculo** (FR-034) — todos fora do caminho de uma requisição de leitura:

1. Upload de novo currículo (`POST /api/me/resume`, depois de extrair o texto).
2. Sincronização de GitHub concluída (`POST /api/me/external-accounts/github/sync`, e a
   primeira conexão).
3. Publicação de uma vaga nova (`POST /api/recruiter/jobs/{id}/publish`) — cria o `JobMatch`
   inicial para todo candidato com currículo vigente.

Em todos os casos: recalcula **todas** as `JobMatch` daquele candidato (gatilhos 1-2) ou
cria a `JobMatch` daquela vaga para todo candidato elegível (gatilho 3). Nunca recalcula no
`GET /api/jobs` nem no `GET /api/jobs/{id}` — essas rotas só leem o que já está na tabela
(mantém o D3 da Sprint 1 válido).

**Visibilidade (FR-035, FR-036)**: a leitura de `JobMatch` nas rotas públicas só retorna a
linha quando `candidateId` é o do usuário autenticado na sessão — nunca o score de outro
candidato, nunca para visitante sem sessão. Candidato autenticado sem `Resume.isCurrent`
simplesmente não tem linha em `JobMatch` ainda; a ausência de linha é o sinal que a tela usa
para mostrar "complete seu perfil" em vez de inventar um score zero.

### Evaluation — efetivamente criada na candidatura (encerra o 🟡 da Sprint 1)

| Campo | Mudança nesta sprint |
|---|---|
| `type` | `RESUME_MATCH` sempre; `GITHUB_ANALYSIS` condicional — ver R14 |
| `score` / `justification` | preenchidos pelo mesmo algoritmo de R12 (ou a variante isolada de GitHub para `GITHUB_ANALYSIS`) |
| `version` | continua em 1 nesta sprint — não há fluxo de reprocessamento implementado ainda, só suportado pelo schema |

Gerada dentro da mesma transação que cria a `Application` (`POST /api/jobs/{id}/apply`,
já existente desde a Sprint 1) — não é um passo separado nem assíncrono, porque o cálculo é
leitura de dados já existentes (currículo extraído, GitHub já sincronizado), não uma chamada
de rede nova.

A imutabilidade (Princípio II) não muda: continua garantida pela trigger `BEFORE UPDATE` já
existente desde T008 (Sprint 1) — esta sprint é a primeira a efetivamente inserir linhas
que a trigger protege de verdade.

---

## Regras transversais novas

| Regra | Onde é garantida |
|---|---|
| RN002 — vaga só publica completa | validação em `src/server/jobs/builder.ts` antes do `UPDATE status = PUBLISHED` (FR-040) |
| FR-041 — vaga publicada trava pipeline/stack | mesma função de `builder.ts` recusa `PATCH`/`PUT` em campos travados quando `status = PUBLISHED` |
| Princípio III — nenhuma candidatura sem avaliação prévia | `Evaluation(RESUME_MATCH)` criada na mesma transação de `apply.ts`, nunca depois |
| Princípio II — score imutável (reforçado) | mesma trigger de `Evaluation`; nenhuma rota nova de update é criada para `Evaluation` nem `JobMatch` |
| FR-032 — currículo cifrado inclui o texto extraído | `Resume.extractedText` passa pelo mesmo `src/server/crypto.ts` do arquivo |

Nenhuma entidade da Sprint 3 (`Challenge`, `CodeDraft`, `CodeSubmission`) é tocada nesta
sprint — seguem 🟡.
