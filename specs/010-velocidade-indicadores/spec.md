# Feature Specification: Meta de Tempo da 3aq, Candidatos Parados e Alertas ao RH

**Feature Branch**: `010-velocidade-indicadores`

**Responsável**: Cassiano

**Created**: 2026-11-07

**Status**: Draft (divisão aprovada em conversa, 07/11; escopo a revisar com a equipe)

**Input**: proposta da demanda da 3aq (`docs/entregas/PROPOSTA_INICIAL_DEMANDA.pdf`) —
"diminuir em pelo menos 50% o tempo gasto entre o anúncio da vaga e a proposta final".

**Por que esta spec existe**: a meta da 3aq é medida de **anúncio da vaga até proposta
final**, mas o sistema só mede "candidatura → aprovação" (`avgDaysToHire` em
`src/server/jobs/overview.ts`). Sem o número certo não dá para provar a meta na banca nem
para a 3aq. E o tempo se perde em candidato esquecido numa etapa: hoje só a **vaga** ganha
selo "Parada" (sem movimento há 7 dias); o **candidato** parado não aparece em lugar nenhum.

**O que já existe e deve ser reaproveitado** (não refazer):
- `getDashboard` (`src/server/jobs/dashboard.ts`): tempo médio por etapa, taxa de avanço
  e etapa gargalo, mostrados em `src/app/(recruiter)/recrutamento/Dashboard.tsx`.
- `getJobsOverview` (`src/server/jobs/overview.ts`): dias aberta, última atividade,
  aguardando decisão, contratações e tempo médio até contratar.
- `ApplicationStageHistory` (`enteredAt`/`exitedAt`): base de todo cálculo de tempo.
- Cron diário da Vercel (`vercel.json`) + `authorizedCron` (`src/server/cron-auth.ts`).

---

## Decisões (propostas — confirmar com a equipe)

| # | Decisão | Motivo |
|---|---|---|
| D1 | "Tempo até a proposta" = `Job.publishedAt` → primeira candidatura que **entra** na etapa Proposta Final (ou é aprovada, se a vaga não tiver Proposta Final). | É exatamente a frase da 3aq. A entrada na etapa está no histórico, sem coluna nova. |
| D2 | **Não há contato com a 3aq** para pedir o tempo de hoje. A linha de base vem de duas evidências, ambas registradas em `docs/entregas/linha-de-base.md` (FR-1008): **(a) referência de mercado com fonte** para o tempo de calendário, em `HIRING_BASELINE_DAYS` com o rótulo `HIRING_BASELINE_LABEL` (ex.: "Referência de mercado · Ford/Datafolha 2026"); **(b) estudo de esforço** feito pela equipe, que mede as dores que a 3aq descreveu (horas do RH lendo currículo e do sênior corrigindo teste, à mão × com o CLTech). O card **nunca** diz "meta da 3aq atingida": diz quanto o tempo está abaixo da referência. Se um dia a 3aq mandar dados reais, eles substituem a referência sem mudar código. | Número de mercado com fonte é verificável; número inventado ou "estimado pela equipe" a banca derruba. O estudo de esforço é a prova mais forte que dá para produzir sem a 3aq, porque mede exatamente o que a proposta reclama. Tempo de calendário só se prova com contratações reais, que não acontecem durante o curso. |
| D3 | Candidato parado = `IN_PROGRESS` e na mesma etapa há mais de N dias (`STALLED_CANDIDATE_DAYS`, padrão 7). Uma constante só, usada também pelo selo "Parada" da vaga. | Hoje o 7 está fixo em `VisaoGeralVagas.tsx`; dois números para "parado" confundem. |
| D4 | Separar **"esperando o RH"** de **"esperando o candidato"**: teste de código liberado e não enviado, dentro do prazo, é espera do candidato e não gera alerta ao RH. | Alerta que o RH não pode resolver vira ruído e passa a ser ignorado. |
| D5 | Alerta por e-mail é **um resumo diário por recrutador** (dono da vaga, `Job.createdById`), só quando há algo parado. | Um e-mail por candidato lotaria a caixa. |
| D6 | **Sem migration.** Tudo sai de tabelas que já existem. | Merge sem risco e sem passo manual em produção. |

---

## User Scenarios & Testing

### User Story 1 — Ver a meta da 3aq no painel (Priority: P1)

**Acceptance Scenarios**:

1. **Given** vagas publicadas no período em que algum candidato chegou à Proposta Final,
   **Then** o painel mostra o card "Do anúncio à proposta": média em dias, quantas vagas
   entraram na conta e, com `HIRING_BASELINE_DAYS` definido, "{rótulo}: X dias · Y% abaixo".
2. **Given** tempo ≤ metade da referência, **Then** o card mostra "Metade ou menos da
   referência"; acima disso, quantos dias faltam para chegar à metade. O texto nunca chama a
   referência de "tempo da 3aq".
3. **Given** nenhuma vaga chegou à proposta ainda, **Then** o card diz "Ainda sem vaga que
   chegou à proposta" (nunca 0 dias nem NaN).
4. **Given** `HIRING_BASELINE_DAYS` não definido, **Then** o card mostra o tempo atual e
   "Sem referência configurada", sem percentual.
5. **Given** filtros de período da visão geral, **Then** o card respeita o mesmo período
   (vaga conta pela data de publicação).

### User Story 2 — Lista de candidatos parados (Priority: P1)

**Acceptance Scenarios**:

1. **Given** candidato na Entrevista de RH há 9 dias, **Then** ele aparece em "Candidatos
   parados" no painel, com vaga, etapa, dias na etapa e link direto para o relatório.
2. **Given** candidato com teste de código liberado e dentro do prazo, **Then** ele aparece
   como "Aguardando o candidato" (separado) ou não aparece, nunca como pendência do RH.
3. **Given** a lista ordenada, **Then** o mais antigo vem primeiro.
4. **Given** vaga encerrada ou rascunho, **Then** seus candidatos não aparecem.

### User Story 3 — Resumo diário por e-mail ao recrutador (Priority: P2)

**Acceptance Scenarios**:

1. **Given** recrutador com 3 candidatos parados em 2 vagas, **When** o cron diário roda,
   **Then** ele recebe um único e-mail "3 candidatos aguardando você", agrupado por vaga,
   com link para cada relatório.
2. **Given** recrutador sem nada parado, **Then** não recebe e-mail.
3. **Given** chamada sem `Authorization: Bearer $CRON_SECRET`, **Then** 401 e nada é enviado.
4. **Given** SMTP desligado, **Then** a varredura termina sem erro (como os outros e-mails).

### User Story 4 — Tempo por etapa na visão de cada vaga (Priority: P3)

**Acceptance Scenario**: na visão geral, abrir uma vaga mostra o tempo médio em cada etapa
**daquela vaga** (reaproveitando `computeFunnel` com um `jobId`), para o RH ver onde ela trava.

---

## Requisitos

- **FR-1001** `src/server/jobs/metrics.ts` → `timeToOffer({ from?, to? })`: média de dias
  entre `publishedAt` e a primeira entrada em `FINAL_OFFER` (ou aprovação), por vaga;
  devolve `{ avgDays: number | null, jobsCounted: number, baselineDays: number | null,
  baselineLabel: string, reductionPct: number | null }`.
- **FR-1002** `src/server/jobs/stalled.ts` → `listStalledCandidates({ recruiterId? })`:
  candidaturas `IN_PROGRESS` de vagas `PUBLISHED` cuja entrada na etapa atual
  (`ApplicationStageHistory` sem `exitedAt`) é mais antiga que `STALLED_CANDIDATE_DAYS`.
  Cada item: candidatura, candidato (nome), vaga, etapa, dias, `waitingOn: "RECRUITER" | "CANDIDATE"`.
- **FR-1003** Constante única `STALLED_DAYS` exportada de `src/lib/` (lida de
  `STALLED_CANDIDATE_DAYS` no servidor, padrão 7); `VisaoGeralVagas.tsx` passa a usar a mesma.
- **FR-1004** `GET /api/recruiter/dashboard` passa a devolver `timeToOffer` e
  `stalledCandidates` (só `RECRUITER`/`ADMIN`).
- **FR-1005** `GET|POST /api/internal/recruiter-digest` (cron, `authorizedCron`): monta e
  envia o resumo por recrutador. Template novo em `src/server/email/templates/recruiter-digest.ts`
  com o mesmo layout dos outros e-mails (`renderEmailLayout`).
- **FR-1006** Agendar em `vercel.json`. **Conferir o limite de crons do plano da Vercel**:
  se não couber um segundo cron, a rota existente de expiração chama a varredura no fim.
- **FR-1007** Documentar `HIRING_BASELINE_DAYS`, `HIRING_BASELINE_LABEL` e `STALLED_CANDIDATE_DAYS` no `.env.example`
  e em `docs/deploy-vercel.md`.
- **FR-1008** `docs/entregas/linha-de-base.md`, com duas partes:
  1. **Referência de mercado**: a métrica da 3aq (anúncio → proposta) equivale a *time to
     fill* (conta a partir da abertura da vaga), não a *time to hire*. Fonte principal:
     pesquisa Ford/Datafolha 2026 com 250 líderes de RH e TI de médias e grandes empresas
     (metade leva de 1 a 2 meses para preencher vaga de tecnologia; 25% chegam a 90 dias).
     Registrar link, data de acesso, o valor escolhido para `HIRING_BASELINE_DAYS` e **a conta
     feita** (ex.: 45 dias = meio da faixa de 1 a 2 meses), além das limitações: não é a 3aq,
     é empresa média/grande, e a 3aq é do CE.
  2. **Estudo de esforço** (a equipe executa e cronometra): o mesmo lote de 20 currículos e
     5 soluções de teste de código, avaliado à mão por duas pessoas da equipe e depois pelo
     CLTech. Registrar o protocolo (lote, critérios, quem fez, quando), o tempo de cada um e
     se os resultados bateram. Mede as duas dores da proposta: "o RH lê centenas de
     currículos" e "os sêniores param para corrigir testes".
- **FR-1009** `HIRING_BASELINE_LABEL` (opcional; padrão "Referência de mercado") é o texto
  mostrado no card ao lado do número.

## Migration

**Não precisa.** Variáveis de ambiente novas (opcionais): `HIRING_BASELINE_DAYS`,
`HIRING_BASELINE_LABEL`, `STALLED_CANDIDATE_DAYS`. Na Vercel, cadastrar antes de apresentar a meta.

## Onde mexe

- Novos: `src/server/jobs/metrics.ts`, `src/server/jobs/stalled.ts`,
  `src/app/api/internal/recruiter-digest/route.ts`, template do resumo.
- `src/server/jobs/dashboard.ts`, `src/app/api/recruiter/dashboard/route.ts`,
  `src/app/(recruiter)/recrutamento/Dashboard.tsx`, `VisaoGeralVagas.tsx` (só a constante e a US4).
- `vercel.json`, `.env.example`, `docs/deploy-vercel.md`, novo `docs/entregas/linha-de-base.md`.

**Não mexe**: `decision.ts` e o relatório da candidatura (spec 009), telas do candidato (spec 011),
`src/server/matching/**`.

## Fora do escopo

- Prazo (SLA) diferente por etapa ou por vaga.
- Alerta por WhatsApp/Slack.
- Relatório exportável em PDF (o card e a lista bastam para a banca).

## Testes

- Unitário: `timeToOffer` com vaga sem Proposta Final (usa aprovação), sem dados (null),
  baseline ausente; classificação `waitingOn` do teste de código dentro/fora do prazo.
- Integração: parados respeitam N dias, excluem vaga encerrada/rascunho, ordenam do mais
  antigo; rota do resumo exige `CRON_SECRET` e agrupa por recrutador (mailer mockado).
- E2E: painel mostra o card e a lista (datas envelhecidas no banco local, como no relatório
  E2E de 07/11).
