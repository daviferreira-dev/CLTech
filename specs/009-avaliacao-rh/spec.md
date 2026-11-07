# Feature Specification: Avaliação Padronizada pelo RH, Motivo de Reprovação e Ações em Lote

**Feature Branch**: `009-avaliacao-rh`

**Responsável**: Davi

**Created**: 2026-11-07

**Status**: Implementada (07/11), exceto FR-909 (export LGPD), que espera o OK do orientador

**Input**: proposta da demanda da 3aq (`docs/entregas/PROPOSTA_INICIAL_DEMANDA.pdf`) —
"cada avaliador tem uma opinião, o que faz com que a escolha do candidato não seja justa ou
baseada apenas na técnica" e "garantir que todos os candidatos sejam avaliados pelos mesmos
critérios técnicos e objetivos".

**Por que esta spec existe**: a parte automática já é igual para todos (compatibilidade e
teste de código, imutáveis — Princípio II). A parte humana não: nas etapas de entrevista o
recrutador só clica Avançar/Reprovar, sem registrar *por quê*. Não há critério comum entre
entrevistadores, o candidato reprovado não sabe o motivo, e reprovar 40 candidatos de uma
vaga exige 40 cliques com confirmação.

---

## Decisões (propostas — confirmar com a equipe)

| # | Decisão | Motivo |
|---|---|---|
| D1 | A ficha de avaliação humana é uma **tabela própria** (`InterviewEvaluation`), separada de `Evaluation`. | `Evaluation` é só resultado automático e imutável (Princípio II, trigger de banco). Misturar opinião humana ali quebra o princípio. |
| D2 | Critérios **fixos por tipo de etapa**, definidos em código (`src/lib/interviewCriteria.ts`), nota de 1 a 5. | Garante "mesmos critérios para todos" sem tela de configuração. Critério configurável pelo RH fica fora (ver Fora do escopo). |
| D3 | Uma ficha por **avaliador × candidatura × etapa**; o avaliador pode editar a própria ficha enquanto a candidatura estiver nessa etapa. | Vários entrevistadores na mesma entrevista; depois que a etapa passou, a ficha congela (histórico confiável). |
| D4 | Ficha **não bloqueia** a decisão: avançar sem ficha numa etapa de entrevista mostra aviso, não erro. | O fluxo atual continua funcionando; a cobrança é visual. |
| D5 | Motivo da reprovação é **obrigatório** ao reprovar (categoria) + **retorno ao candidato** opcional (texto livre). | A categoria alimenta indicadores; o texto é o "feedback de verdade" que o candidato pede. |
| D6 | Ficha, comentários e a **categoria** do motivo são internos. Ao candidato vai só o **retorno** que o recrutador escreveu para ele. `{{motivo}}` existe (rótulo amigável), mas o modelo padrão não o usa: entra só se o RH o colocar no modelo. | Princípio I e spec 004 FR-108 ("sem expor score nem motivo interno"). O retorno é texto escrito *para* o candidato, então não é motivo interno. FR-108 ganha essa exceção explícita. |
| D7 | Ação em lote reaproveita `recordDecision` candidatura por candidatura (sem atalho no banco). | Mesmas regras, mesmos e-mails, mesmo histórico; nada de caminho paralelo para dar bug. |

---

## User Scenarios & Testing

### User Story 1 — Entrevistador preenche a ficha padrão (Priority: P1)

Na etapa de Entrevista de RH ou Entrevista Técnica, o recrutador abre o relatório da
candidatura e preenche a ficha: uma nota de 1 a 5 por critério, um comentário e uma
recomendação (Avançar / Em dúvida / Não avançar).

**Acceptance Scenarios**:

1. **Given** candidatura na Entrevista Técnica, **When** o recrutador preenche os quatro
   critérios técnicos, comentário e recomendação e salva, **Then** a ficha aparece no
   relatório com o nome do avaliador, a data e a média das notas.
2. **Given** dois recrutadores avaliaram a mesma candidatura na mesma etapa, **Then** o
   relatório mostra as duas fichas e a média geral por critério.
3. **Given** a candidatura já saiu da etapa, **When** o avaliador tenta editar a ficha,
   **Then** recebe 409 `STAGE_CLOSED` e a ficha não muda.
4. **Given** etapa que não é entrevista (Análise de Currículo, Teste de Código, Análise de
   GitHub, Proposta Final), **Then** o bloco da ficha não aparece.
5. **Given** candidatura em entrevista sem nenhuma ficha, **When** o recrutador clica
   Avançar, **Then** a confirmação avisa "Ninguém preencheu a ficha desta entrevista" e
   permite seguir.

### User Story 2 — Reprovar com motivo e retorno ao candidato (Priority: P1)

**Acceptance Scenarios**:

1. **Given** o diálogo Reprovar, **Then** ele exige escolher um motivo da lista e oferece um
   campo opcional "Retorno ao candidato (vai no e-mail)".
2. **Given** motivo "Conhecimento técnico abaixo do esperado" e retorno "Recomendamos
   aprofundar testes automatizados", **When** reprova, **Then** o e-mail de reprovação
   traz `{{motivo}}` e `{{retorno}}` preenchidos, e a candidatura grava os dois.
3. **Given** modelo de e-mail de reprovação que não usa `{{retorno}}` e retorno preenchido,
   **Then** o retorno é anexado ao final do e-mail num bloco "Retorno do recrutador"
   (o recrutador escreveu para o candidato ler).
4. **Given** encerrar vaga com candidatos em andamento, **Then** todos ficam com motivo
   `JOB_CLOSED` automaticamente, sem retorno.
5. **Given** reprovar sem motivo pela API, **Then** 400 e nada muda.

### User Story 3 — Ações em lote na lista de candidatos da vaga (Priority: P1)

Em `/recrutamento/vagas/[id]/candidaturas`, o recrutador marca vários candidatos e escolhe
"Reprovar selecionados" ou "Avançar selecionados".

**Acceptance Scenarios**:

1. **Given** 12 candidatos marcados, **When** "Reprovar selecionados" com um motivo, **Then**
   os 12 ficam reprovados, cada um recebe o seu e-mail, e a tela mostra "12 reprovados".
2. **Given** seleção com candidato já reprovado ou aprovado, **Then** ele é ignorado e o
   resumo diz "10 reprovados, 2 ignorados (já finalizados)".
3. **Given** seleção cuja próxima etapa é uma entrevista, **When** "Avançar selecionados",
   **Then** a ação é recusada com "Para entrevistas, avance um por vez para marcar a
   reunião" (a reunião é obrigatória e individual).
4. **Given** mais de 50 selecionados, **Then** o botão avisa o limite (50 por vez).
5. **Given** falha em um item no meio do lote, **Then** os outros seguem e o resumo lista
   quem falhou e por quê.

---

## Requisitos

- **FR-901** Tabela `InterviewEvaluation`: `id`, `applicationId` (cascade), `stageId`,
  `evaluatorUserId`, `scores Json` (`{ critério: 1..5 }`), `comment String?` (≤2000),
  `recommendation` enum `InterviewRecommendation` (`ADVANCE`, `UNSURE`, `REJECT`),
  `createdAt`, `updatedAt`. Único por (`applicationId`, `stageId`, `evaluatorUserId`).
- **FR-902** Critérios em `src/lib/interviewCriteria.ts`:
  - `HR_INTERVIEW`: Comunicação, Motivação, Alinhamento com a vaga.
  - `TECH_INTERVIEW`: Lógica e resolução de problemas, Conhecimento técnico, Qualidade de
    código/arquitetura, Comunicação técnica.
  Validação no servidor: todos os critérios da etapa presentes, inteiros de 1 a 5, nenhum a mais.
- **FR-903** `PUT /api/recruiter/applications/[id]/interview-evaluation` (cria ou atualiza
  a ficha do usuário logado na etapa atual). `GET` no relatório devolve todas as fichas da
  candidatura com nome do avaliador e médias. Só `RECRUITER`/`ADMIN`.
- **FR-904** Enum `RejectionReason`: `TECHNICAL_SKILLS`, `CODE_TEST_SCORE`,
  `INTERVIEW_PERFORMANCE`, `REQUIREMENTS_NOT_MET`, `POSITION_FILLED`, `JOB_CLOSED`,
  `NO_RESPONSE`, `OTHER`. Rótulos amigáveis ao candidato em `src/lib/labels.ts`.
- **FR-905** `Application` ganha `rejectionReason RejectionReason?` e
  `rejectionFeedback String?` (≤1000). **Contrato com a spec 011**: a frente do Guilherme lê
  esses dois campos para o aviso ao candidato; não renomear depois do merge.
- **FR-906** `recordDecisionSchema` aceita `rejection: { reason, feedback? }`, obrigatório
  quando `decision = "REJECT"`. Encerrar vaga e "vaga preenchida" (aprovação esgota as
  vagas) gravam `JOB_CLOSED` / `POSITION_FILLED` sozinhos.
- **FR-907** Variáveis novas no momento `REJECTED`: `{{motivo}}` e `{{retorno}}`
  (`EMAIL_MOMENT_VARIABLES` e prévia com dados de exemplo); `{{motivo}}` fica disponível para
  o RH. **Implementado assim (07/11)**: o texto do modelo padrão **não muda** (mudar exigiria
  reescrever uma linha que o RH pode já ter editado em produção). Quando há retorno e o
  modelo não usa `{{retorno}}`, ele entra sozinho no fim do e-mail, num bloco "Retorno do
  recrutador". A nota de FR-108 na spec 004 foi atualizada com essa exceção.
- **FR-907a** O retorno (`rejectionFeedback`) e o comentário da ficha são **cifrados** em
  repouso, como os outros textos livres do candidato, e entram na rotação de chave
  (`src/server/reencrypt.ts`).
- **FR-908** `POST /api/recruiter/jobs/[id]/applications/bulk-decision`:
  `{ applicationIds: string[] (1..50), decision: "ADVANCE" | "REJECT", rejection? }`.
  Chama `recordDecision` em sequência e devolve `{ done: [...], skipped: [...], failed: [...] }`.
  Recusa `ADVANCE` quando a próxima etapa de algum item é entrevista.
- **FR-909** Export LGPD (`exportMyData` em `src/server/candidates/privacy.ts`) passa a
  incluir, por candidatura:
  - `rejectionReason` (rótulo amigável) e `rejectionFeedback`;
  - **as fichas de entrevista**: etapa, notas por critério, recomendação e comentário, com o
    avaliador **anonimizado** ("Avaliador 1", "Avaliador 2", na ordem de criação; nunca nome
    nem e-mail do funcionário);
  - **as notas automáticas** (`Evaluation`: tipo, nota, justificativa, versão, data). Hoje o
    export não traz nenhuma nota, só o código enviado; corrigir junto para tratar nota humana
    e automática do mesmo jeito.

  Decisão de 07/11 (LGPD art. 18, II: a avaliação é dado pessoal do candidato). Leitura
  técnica da equipe, **a confirmar com o orientador**. **Ainda não implementado**: fica para
  depois do OK dele, num PR à parte (o resto da spec não depende disto).
- **FR-909a** O formulário da ficha mostra, acima do comentário: "O candidato pode ter acesso
  a esta avaliação se pedir os dados dele (LGPD)."
- **FR-910** Relatório da candidatura mostra o motivo e o retorno de quem foi reprovado, e o
  histórico de fichas por etapa.

## Migration

**Precisa de migration** (tabela `InterviewEvaluation`, enums `InterviewRecommendation` e
`RejectionReason`, duas colunas em `Application`). Em produção ela tem de ser aplicada
**antes** do deploy.

## Onde mexe

- `prisma/schema.prisma` + `prisma/migrations/…_avaliacao_rh`
- `src/server/applications/decision.ts`, `src/lib/validation/applications.ts`
- `src/server/email/notify.ts` (só os parâmetros do `notifyApplicationClosed`), `src/lib/emailMoments.ts`
- Novo `src/server/applications/interview-evaluation.ts` e a rota da ficha
- `.../candidaturas/[applicationId]/` — novo componente `InterviewEvaluationCard.tsx`;
  em `ApplicationDetailView.tsx` só a linha que o inclui e o diálogo de reprovar
- `.../candidaturas/CandidatesForJobList.tsx` (seleção e barra de ações em lote)
- `src/server/candidates/privacy.ts` (só o bloco de candidaturas do `exportMyData`)

**Não mexe**: `src/server/matching/**`, `Evaluation`, telas do candidato (são da spec 011).

## Fora do escopo

- Critérios configuráveis pelo RH por vaga.
- Peso das fichas no ranking automático (o ranking continua só automático — Princípio II).
- Convite de calendário (.ics) e agenda.

## Testes

- Unitário: validação da ficha contra os critérios da etapa; preenchimento de `{{motivo}}`/`{{retorno}}`.
- Integração: ficha única por avaliador/etapa, ficha congelada após sair da etapa, reprovar
  exige motivo, encerrar vaga grava `JOB_CLOSED`, lote com itens ignorados e com falha,
  lote recusa avançar para entrevista, isolamento (candidato recebe 403 nas rotas novas),
  export traz fichas com avaliador anonimizado (sem nome/e-mail do recrutador) e as notas
  automáticas (`lgpd-rights`).
- E2E: reprovar com motivo → e-mail no Mailpit com o retorno; reprovar 3 em lote.
