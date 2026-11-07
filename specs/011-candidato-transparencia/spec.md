# Feature Specification: Desistir da Candidatura, Avisos no Sistema e Revisão Humana

**Feature Branch**: `011-candidato-transparencia`

**Responsável**: Guilherme

**Created**: 2026-11-07

**Status**: Draft (divisão aprovada em conversa, 07/11; escopo a revisar com a equipe)

**Input**: proposta da demanda da 3aq (`docs/entregas/PROPOSTA_INICIAL_DEMANDA.pdf`) —
"oferecer feedback automático e imediato aos candidatos" e o cuidado com "viés
algorítmico" citado em Ciência de Dados; pesquisa de mercado de 07/11: falta de retorno e de
status é a principal queixa de candidatos em plataformas de recrutamento.

**Por que esta spec existe**: hoje o candidato só fica sabendo de algo por e-mail. Se o
e-mail cair no spam, ele não sabe de nada. Não há como desistir (o status `WITHDRAWN` existe
no banco e na tela, mas nenhuma ação leva a ele). E a triagem é automática: a LGPD (art. 20)
dá ao titular o direito de pedir **revisão** de decisão tomada só por tratamento automatizado
e de receber informação sobre os **critérios** usados. Isso hoje não existe.

---

## Decisões (propostas — confirmar com a equipe)

| # | Decisão | Motivo |
|---|---|---|
| D1 | Desistir é **definitivo** para aquela vaga: não dá para se candidatar de novo. | `Application` é único por (candidato, vaga) no banco (FR-022). Reabrir exigiria mudar essa garantia. A confirmação deixa isso claro. |
| D2 | Avisos no sistema são criados **no mesmo ponto onde sai o e-mail** (`src/server/email/notify.ts`), por um módulo próprio chamado de lá. Se o e-mail falhar, o aviso existe mesmo assim. | Um lugar só decide "o candidato deve saber disto"; o aviso é o canal que nunca cai no spam. |
| D3 | Aviso tem texto curto e um link; **nunca** score, ficha ou motivo interno. | Princípio I e spec 004 FR-108. |
| D4 | Revisão humana **não altera a nota** automática. O RH responde por escrito e, se for o caso, muda a *decisão* (ex.: reverte a reprovação pelo fluxo normal). | Princípio II: score é imutável; a decisão humana é campo separado. |
| D5 | **Texto geral "Como avaliamos"**: explica como a triagem funciona (compara as tecnologias exigidas pela vaga com currículo, perfil e GitHub; teste de código corrigido por casos de teste iguais para todos). | Atende ao art. 20 (critérios e procedimentos) para todos, inclusive quem ainda não foi avaliado. |
| D6 | **Explicação por candidato, limitada (decidido em 07/11)**: o candidato vê, da própria candidatura, só a lista das tecnologias exigidas pela vaga separadas em "Encontramos no seu perfil" e "Não encontramos". **Nunca**: número, percentual, ranking, comparação com outros, detalhes do GitHub. Aparece só depois que a triagem terminou (`matchScoreStatus = CALCULATED`). | É o "retorno automático e imediato" que a 3aq pediu, e o art. 20 pede os critérios. Risco baixo: as tecnologias exigidas já são públicas na página da vaga, e a regra de privacidade protege o candidato de terceiros, não esconde dele os dados dele. **Exige emenda** de uma frase no Princípio I e no FR-108 (FR-1109), **a confirmar com o orientador** antes do merge. |
| D7 | Um pedido de revisão **por candidatura**, até 30 dias depois da decisão. | Evita uso repetido como canal de reclamação; prazo dá previsibilidade ao RH. |

---

## User Scenarios & Testing

### User Story 1 — Desistir da candidatura (Priority: P1)

**Acceptance Scenarios**:

1. **Given** candidatura em andamento, **When** o candidato clica "Desistir desta vaga" em
   `/candidaturas` e confirma, **Then** o status vira `WITHDRAWN`, a etapa atual é fechada no
   histórico e a tela mostra "Candidatura retirada por você."
2. **Given** a confirmação, **Then** ela avisa "Você não poderá se candidatar de novo a esta vaga."
3. **Given** teste de código em andamento, **When** desiste, **Then** o rascunho deixa de
   aceitar envio (409 em `submit`/`run`) e a varredura de prazo vencido não o envia mais.
4. **Given** candidatura já reprovada, aprovada ou retirada, **Then** o botão não aparece e a
   API devolve 409 `APPLICATION_CLOSED`.
5. **Given** o RH abre a vaga, **Then** o candidato aparece como "Retirada" e sai das
   contagens de "em andamento" e de "aguardando decisão".

### User Story 2 — Avisos dentro do sistema (Priority: P1)

**Acceptance Scenarios**:

1. **Given** o candidato avançou de etapa, foi reprovado, aprovado ou a vaga encerrou,
   **Then** aparece um aviso no sino do cabeçalho, com contador de não lidos.
2. **Given** reprovação com retorno do recrutador (spec 009, `rejectionFeedback`), **Then** o
   aviso inclui o retorno.
3. **Given** clicar no aviso, **Then** ele vira lido e leva para `/candidaturas` (ou para o
   teste, no caso de teste liberado).
4. **Given** "Marcar todos como lidos", **Then** o contador zera.
5. **Given** SMTP desligado, **Then** o aviso é criado mesmo assim.
6. **Given** outro usuário, **Then** nunca vê avisos alheios (403/lista vazia).

### User Story 3 — Ver o que a triagem encontrou no meu perfil (Priority: P2)

**Acceptance Scenarios**:

1. **Given** vaga que exige React, Node.js e Docker e triagem concluída, **When** o candidato
   abre `/candidaturas`, **Then** vê "Encontramos no seu perfil: React, Node.js" e "Não
   encontramos: Docker", sem nenhum número.
2. **Given** triagem ainda em processamento ou com falha, **Then** o bloco não aparece
   (vale o texto geral "Como avaliamos").
3. **Given** a resposta da API, **Then** ela não contém `matchScore`, `score` nem dados do
   GitHub (teste de integração confere as chaves).
4. **Given** outro candidato, **Then** 403 (só o dono vê a própria lista).

### User Story 4 — Pedir revisão humana (Priority: P2)

**Acceptance Scenarios**:

1. **Given** candidatura reprovada há menos de 30 dias, **Then** `/candidaturas` mostra
   "Como avaliamos" (texto fixo, D5) e o botão "Pedir revisão por uma pessoa".
2. **Given** o candidato envia o pedido com um texto (até 1000 caracteres), **Then** o
   pedido fica `OPEN`, o RH vê no relatório da candidatura e no painel ("Revisões pendentes").
3. **Given** o RH responde, **Then** o pedido vira `ANSWERED`, o candidato recebe aviso e
   e-mail com a resposta, e a nota automática continua igual.
4. **Given** já existe um pedido para a candidatura ou passaram 30 dias, **Then** o botão não
   aparece e a API devolve 409.

---

## Requisitos

- **FR-1101** `POST /api/me/applications/[id]/withdraw` (só o dono, `CANDIDATE`): status
  `WITHDRAWN`, `exitedAt` na etapa atual, numa transação. Rotas de teste de código e a
  varredura `code-tests/expire` passam a ignorar candidatura não `IN_PROGRESS`.
- **FR-1102** Tabela `Notification`: `id`, `userId` (cascade), `kind` (enum:
  `STAGE_ADVANCED`, `REJECTED`, `APPROVED`, `JOB_CLOSED`, `CODE_TEST_RELEASED`,
  `REVIEW_ANSWERED`), `title` (≤120), `body` (≤1000), `href`, `readAt?`, `createdAt`.
  Índice por (`userId`, `readAt`).
- **FR-1103** `src/server/notifications.ts` (`createNotification`, `listNotifications`,
  `markRead`, `markAllRead`). `notify.ts` chama `createNotification` em cada função, **antes**
  do envio de e-mail, com uma linha por função (sem reescrever `notify.ts`).
- **FR-1104** `GET /api/me/notifications`, `POST /api/me/notifications/read` (`{ ids? }`;
  sem ids = todos). Sino no cabeçalho só para `CANDIDATE`, com contador e lista.
- **FR-1105** Tabela `ReviewRequest`: `id`, `applicationId` (único, cascade), `message`
  (≤1000), `status` (`OPEN`, `ANSWERED`), `response?` (≤2000), `answeredByUserId?`,
  `createdAt`, `answeredAt?`.
- **FR-1106** `POST /api/me/applications/[id]/review-request` (dono, reprovada, ≤30 dias, sem
  pedido anterior). `POST /api/recruiter/applications/[id]/review-request/answer`
  (`RECRUITER`/`ADMIN`). Export LGPD inclui pedidos e respostas.
- **FR-1107** Texto "Como avaliamos" em `src/lib/` (um lugar só), revisado pela equipe,
  linkado também em `/privacidade`.
- **FR-1108** Relatório da candidatura ganha o componente `ReviewRequestCard.tsx`; em
  `ApplicationDetailView.tsx` entra só a linha que o inclui.
- **FR-1109** Emenda (mesmo PR, depois do OK do orientador):
  - `.specify/memory/constitution.md`, Princípio I, acrescentar: "Exceção: o candidato vê, da
    própria candidatura, quais competências exigidas pela vaga foram encontradas ou não no
    perfil dele, sem nota nem comparação." Subir a versão da constituição e registrar a data.
  - `specs/004-fluxo-funcional-telas/spec.md`, FR-108: a mesma exceção.
- **FR-1110** `src/server/applications/list.ts` (lista do candidato) devolve, por
  candidatura com triagem concluída, `triage: { found: string[], notFound: string[] }`,
  montado a partir de `Evaluation.justification` (`matched`/`missing`) da versão mais recente
  de `RESUME_MATCH`. Só nomes de tecnologia; nada de nota.

## Migration

**Precisa de migration** (tabelas `Notification` e `ReviewRequest`, enums de tipo e status).
Em produção ela tem de ser aplicada **antes** do deploy. Esta frente entra no `main` **por
último**: antes do merge, atualizar a branch com o `main` (que já terá a migration da 009) e
gerar a migration de novo se o `schema.prisma` tiver mudado.

## Dependência com a spec 009

Lê `Application.rejectionReason` e `Application.rejectionFeedback` (FR-905 da 009) para o
aviso de reprovação. Enquanto a 009 não estiver no `main`, o aviso sai sem o retorno.

## Onde mexe

- `prisma/schema.prisma` + `prisma/migrations/…_candidato_transparencia`
- Novos: `src/server/notifications.ts`, `src/server/applications/withdraw.ts`,
  `src/server/applications/review-request.ts`, rotas `api/me/notifications/**`,
  `api/me/applications/[id]/withdraw`, `.../review-request`, e o `answer` do RH
- `src/server/email/notify.ts` (só uma chamada por função), `src/server/code-test/**`
  (ignorar candidatura não ativa), rota `code-tests/expire`
- `src/app/(candidate)/candidaturas/page.tsx`, `src/server/applications/list.ts`, cabeçalho
  (`src/components/layout/`), `/privacidade`
- `.specify/memory/constitution.md` (Princípio I) e `specs/004-fluxo-funcional-telas/spec.md` (FR-108)
- Relatório da candidatura: componente novo `ReviewRequestCard.tsx`

**Não mexe**: `decision.ts` e a ficha de avaliação (spec 009), painel e métricas (spec 010),
`src/server/matching/**`, `Evaluation`.

## Fora do escopo

- Chat entre candidato e recrutador.
- Avisos para o RH (o resumo diário da spec 010 cobre).
- Notificação push no navegador.
- Mostrar ao candidato nota, percentual, ranking ou análise do GitHub (continua só para o RH).

## Testes

- Integração: desistir (dono, status, histórico, teste de código bloqueado, varredura
  ignora), outro candidato recebe 403; avisos criados em cada momento mesmo com mailer
  falhando; isolamento de avisos; revisão (prazo, um por candidatura, resposta não muda
  `Evaluation`).
- Unitário: texto do aviso nunca contém score; montagem de `found`/`notFound` a partir da
  justificativa (versão mais recente, lista vazia sem quebrar).
- Integração: lista do candidato traz `triage` só com triagem concluída e sem nenhuma chave de nota.
- E2E: desistir com confirmação; sino mostra o aviso de avanço; pedido de revisão e resposta.
