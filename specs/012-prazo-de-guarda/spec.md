# Feature Specification: Prazo de Guarda dos Dados do Candidato (LGPD)

**Feature Branch**: `012-prazo-de-guarda`

**Responsável**: Davi

**Created**: 2026-11-12

**Status**: Proposta — **todos os prazos abaixo são PROPOSTA** e esperam a confirmação da equipe e do
orientador. Nada está implementado.

**Input**: `specs/006-lgpd/` (direitos do titular, aviso de privacidade) e a "próxima rodada" de
`specs/DIVISAO-EQUIPE.md` ("prazo de guarda dos dados (LGPD)"). Base legal: LGPD art. 6º III
(necessidade — guardar o mínimo), art. 15–16 (o tratamento termina quando a finalidade acaba;
os dados são eliminados) e art. 9º II (o titular tem de saber por quanto tempo).

As questões de LGPD são **leitura técnica da equipe, não parecer jurídico**.

**Por que esta spec existe**: hoje nada é apagado sozinho. Currículo, perfil, fichas de entrevista,
código enviado e notas ficam para sempre, mesmo de quem foi reprovado há anos ou nunca mais entrou.
A única saída é o próprio titular pedir a exclusão (spec 006, US5). A lei pede o contrário: guardar
só pelo tempo que a finalidade (participar de um processo seletivo) exige. E o aviso de privacidade
(006, US6) promete "por quanto tempo" sem ter um número para dizer.

---

## O que existe hoje (leitura do código em 12/11)

| Dado | Onde | Quem apaga hoje |
|---|---|---|
| Conta (`User`), perfil (`Candidate`, experiências, formações, idiomas, links) | `prisma/schema.prisma` | Só o titular, por `deleteMyAccount` (`src/server/candidates/privacy.ts`) |
| Currículo: arquivo cifrado no bucket + `Resume.extractedText` cifrado | Supabase Storage + `Resume` | Só a exclusão da conta (apaga o banco numa transação e o bucket em melhor esforço) |
| Candidaturas (`Application`), histórico de etapas, `JobMatch` | banco | Exclusão da conta; apagar a vaga leva as candidaturas por cascade |
| Fichas de entrevista (`InterviewEvaluation`, spec 009) e motivo/retorno da reprovação | banco, cascade de `Application` | Exclusão da conta |
| Resultados do teste de código: `CodeDraft`, `CodeSubmission`, `Evaluation` (trigger bloqueia *alterar*, não apagar) | banco, cascade de `Application` | Exclusão da conta |
| Snapshot do GitHub (`GithubProfile`), contas externas | banco, cascade de `Candidate` | Exclusão da conta |
| E-mails enviados | **não há tabela**; o envio passa por `src/server/email/mailer.ts` e só o provedor de e-mail guarda cópia | Fora do nosso controle (ver D5) |
| `PasswordResetToken`, `RateLimit` | banco; já têm `expiresAt`/`resetAt` | Ninguém: linhas vencidas ficam acumulando |
| Último acesso do usuário | **não existe** coluna | — |

O `deleteMyAccount` já resolve "como apagar tudo de uma pessoa" (inclusive a armadilha da ordem
`Application` → `Resume` com RESTRICT). Esta spec decide **quando** apagar e **avisa antes**; o
"como" é reaproveitado.

---

## Decisões (propostas — confirmar com a equipe e o orientador)

| # | Decisão | Motivo |
|---|---|---|
| D1 | Cada prazo conta do **fim da finalidade** daquele dado (candidatura encerrada, conta sem uso), não da data de cadastro. | Enquanto há processo em andamento, o dado é necessário. |
| D2 | Ao fim do prazo, **apagar** (como a spec 006), não anonimizar linha por linha. A estatística que sobra vai para uma tabela de **totais** (`RetentionStat`) gravada antes de apagar. | Anonimizar de verdade um currículo ou um código-fonte é difícil; apagar é simples e verificável. Total por mês e vaga não identifica ninguém. |
| D3 | O candidato é **avisado por e-mail 30 dias antes** de qualquer apagamento automático. | Art. 9º e transparência; dá chance de baixar os dados (006, US4) ou de manter a conta. |
| D4 | Contas **ativas voltam a contar do zero** quando a pessoa entra: login renova `lastActiveAt` e cancela o aviso pendente. | Evita apagar quem está usando. |
| D5 | **E-mails registrados**: o CLTech não guarda histórico de envio; só `EmailTemplate`, que não é dado pessoal. A cópia que o provedor mantém segue a política dele, e a spec só registra isso no aviso de privacidade. | Não criar tabela de log só para depois apagá-la. |
| D6 | Só **candidatos**. Recrutador e administrador ficam fora (já eram fora da 006). | Têm decisões e vagas vinculadas; saem por processo administrativo. |
| D7 | A varredura tem **cron próprio** (`/api/internal/retention`), separado do `expire` (ver Como roda). | Vercel Hobby permite 100 crons por projeto, com 1 execução por dia; falha de uma varredura não afeta a outra. |

---

## Quais dados e por quanto tempo (PROPOSTA)

Prazos contados em meses a partir da data indicada. **Todos** são proposta; a coluna "Por quê"
é o raciocínio da equipe, não decisão jurídica.

| Dado | Prazo proposto | Conta a partir de | Ao fim do prazo | Por quê |
|---|---|---|---|---|
| **Candidatura em andamento** (e tudo que depende dela) | Não apaga | — | — | Processo seletivo em curso é a finalidade. |
| **Candidatura reprovada ou desistida** (`Application`, histórico de etapas, motivo e retorno, `JobMatch`) | **12 meses** | Saída da última etapa (histórico) | Apagar a candidatura; antes, somar em `RetentionStat` | Tempo razoável para o candidato pedir revisão (art. 20) e para o RH responder dúvida sobre o processo. |
| **Candidatura aprovada** | **24 meses** | Saída da última etapa | Idem | Vira vínculo de trabalho fora do CLTech; o histórico de contratação é da empresa. Prazo é pergunta aberta (P3). |
| **Fichas de entrevista** (`InterviewEvaluation`) | Junto com a candidatura | — | Saem por cascade | O candidato pode pedi-las no export (009 FR-909); enquanto a candidatura existir, o direito de acesso existe. |
| **Resultados de teste de código** (`CodeSubmission`, `Evaluation`) | Junto com a candidatura | — | Saem por cascade | Idem; `Evaluation` é imutável (Princípio II), mas apagar a candidatura inteira já é permitido (006). |
| **Rascunhos de código** (`CodeDraft`) | **30 dias** | Envio ou expiração do teste | Apagar | O que vale é a submissão; o rascunho é cópia intermediária. |
| **Currículo (arquivo + `extractedText`)** usado em candidatura | Junto com a candidatura | — | Apagar linha e objeto do bucket | O currículo existe para a candidatura. |
| **Currículo antigo** (não atual, sem candidatura apontando para ele) | **6 meses** | `uploadedAt` | Apagar linha e objeto do bucket | Versão substituída não serve a nenhum processo. |
| **Perfil** (`Candidate`, experiências, formações, idiomas, links, `GithubProfile`, contas externas) | Junto com a **conta** | — | Apagar com a conta | O perfil é reaproveitado em candidaturas futuras; só perde a finalidade quando a conta sai. |
| **Conta inativa** (candidato sem login **e** sem candidatura em andamento) | **24 meses** | `lastActiveAt` | Aviso 30 dias antes; depois excluir como em `deleteMyAccount` | Sem uso e sem processo, não há finalidade. |
| **E-mails registrados** | Sem prazo no CLTech | — | — | D5: não guardamos. Provedor tem política própria. |
| `PasswordResetToken` vencido | 7 dias após `expiresAt` | `expiresAt` | Apagar | Limpeza; já é inútil. |
| `RateLimit` vencido | 7 dias após `resetAt` | `resetAt` | Apagar | Idem. |

### O que fica para estatística (sem identificar a pessoa)

Antes de apagar uma candidatura, a varredura soma uma linha em `RetentionStat`:

- mês de encerramento, vaga (`jobId`), situação final (`APPROVED`/`REJECTED`/`WITHDRAWN`), motivo de
  reprovação (`RejectionReason`), tipo da última etapa;
- **contagens e somas**: quantidade, soma dos dias do processo, soma da nota de compatibilidade
  (para média).

Não guarda `candidateId`, nome, e-mail, texto livre, código, nota individual nem data exata. Como é
total por mês e vaga, uma vaga com 1 candidato no mês identificaria a pessoa pelo contexto: nesses
casos o total entra **sem a vaga** (só mês e situação). Regra e limite mínimo (5) são pergunta P5.

Consequência: indicadores que a spec 010 calcula "ao vivo" (tempo até a proposta) só enxergam
candidaturas ainda guardadas; o histórico mais velho vem de `RetentionStat`. Ajustar a 010 para
somar as duas fontes é **fora desta spec** (ver Fora do escopo).

---

## Aviso antes de apagar

- **30 dias antes** do apagamento, o candidato recebe um e-mail (mesmo layout dos demais,
  `renderEmailLayout`) dizendo: o que será apagado, em que dia, e como evitar ou antecipar:
  - conta inativa: "entre na sua conta e ela continua";
  - candidatura encerrada: "baixe seus dados em /perfil se quiser guardá-los; não precisa fazer nada
    para que sejam apagados".
- Um aviso por **candidatura** e um por **conta**, nunca vários no mesmo dia: se houver mais de um
  item vencendo, o e-mail os lista juntos.
- O aviso é registrado em colunas `retentionWarnedAt` (em `User` e `Application`); só apaga quem
  foi avisado há ≥ 30 dias. Sem aviso gravado, não apaga (isso protege contra e-mail que falhou:
  se o envio falhar, nada é apagado e a próxima execução tenta de novo).
- Login (conta) ou nova candidatura (conta) limpa o aviso da conta (D4).
- Dados que a pessoa pediu para excluir antes seguem a spec 006, sem prazo.

---

## Como roda

- **Vercel Hobby** (documentação oficial): até 100 cron jobs por projeto, **1 execução por dia**
  por cron, com margem de até 59 minutos no horário. `vercel.json` tem 1 cron
  (`/api/internal/code-tests/expire`, 06:00); a spec 010 terá o seu (resumo diário).
- **Proposta**: **cron separado** `/api/internal/retention`, no `vercel.json`, protegido por
  `authorizedCron` (exige `CRON_SECRET`, como a `expire`). Cada varredura falha sozinha, sem
  afetar a outra.
- **A Vercel não refaz chamada que falha e pode entregar a mesma chamada duas vezes**: por isso a
  varredura é idempotente (abaixo) e quem não foi alcançado hoje é pego na execução do dia seguinte.
- **Limite de tempo**: a função da Vercel Hobby é curta. A varredura processa **no máximo 100
  itens por execução** (candidaturas + contas) e deixa o resto para o dia seguinte. Com cron
  diário, 100/dia sobra para o volume de um projeto acadêmico.
- **Modo seguro de estreia**: variável `RETENTION_ENFORCE` (padrão `false`). Desligada, a varredura
  só **avisa** e registra no log "apagaria X"; ligada, apaga. A primeira semana roda desligada.
- **Idempotente**: pode rodar duas vezes no mesmo dia sem efeito extra (o aviso grava a data;
  o apagamento só pega quem já passou do prazo).
- Rota também chamável por `POST` com `CRON_SECRET` para teste manual, como a `expire` (o cron da Vercel chama com `GET`).

---

## Quanto afeta o que já existe

- **Export da 006 (`exportMyData`)**: o que o titular pode baixar **não muda**. Acrescenta-se, por
  candidatura, `retentionDeleteAt` (data prevista de apagamento), para a pessoa saber o prazo
  dela. `RetentionStat` **não entra** no export: não é dado pessoal.
- **Exclusão da 006 (`deleteMyAccount`)**: o miolo (transação `Application` → `User` e depois
  bucket em melhor esforço) é extraído para uma função sem a confirmação `EXCLUIR`, e é a mesma
  que a varredura chama. O comportamento para o titular continua idêntico. Quando o titular exclui
  a conta a pedido dele, **não** se grava `RetentionStat` (a exclusão é pedido, não rotina).
- **Aviso de privacidade (006, FR-307, `/privacidade`)**: deve passar a trazer a tabela de prazos
  aprovada. Hoje o texto é genérico quanto à duração.
- **Spec 009**: nada muda no schema dela. `rejectionFeedback` e as fichas saem junto com a
  candidatura, por cascade.
- **Spec 011**: avisos do sistema (`Notification`) e pedidos de revisão (`ReviewRequest`) apontam
  para a candidatura; quando ela for apagada eles saem junto. Conferir o `onDelete` quando a 011
  entrar no `main` (pergunta de integração, não bloqueia).
- **Próxima rodada, "banco de talentos vivo" (Cassiano)**: **conflita** com apagar candidatura
  reprovada em 12 meses. Sem decisão, o banco de talentos teria de se limitar ao que ainda existe.
  Ver P2.

---

## User Scenarios & Testing

### User Story 1 — Candidatura encerrada é apagada no prazo (Priority: P1)

**Acceptance Scenarios**:

1. **Given** uma candidatura reprovada há 13 meses, avisada há 31 dias, **When** a varredura roda
   com `RETENTION_ENFORCE=true`, **Then** `Application`, histórico, fichas, submissões, avaliações e
   o objeto do currículo (se nenhuma outra candidatura o usa) somem, e `RetentionStat` ganha +1 no
   mês e situação correspondentes.
2. **Given** a mesma candidatura mas **sem aviso gravado**, **When** a varredura roda, **Then**
   nada é apagado; o aviso é enviado e `retentionWarnedAt` gravado.
3. **Given** candidatura reprovada há 11 meses, **When** a varredura roda, **Then** nada acontece.
4. **Given** candidatura em andamento de qualquer idade, **Then** nunca é tocada.
5. **Given** `RETENTION_ENFORCE=false`, **Then** avisa e loga "apagaria", mas não apaga.

### User Story 2 — Conta inativa recebe aviso e é excluída (Priority: P1)

1. **Given** candidato sem login há 24 meses e sem candidatura em andamento, **When** a varredura
   roda, **Then** recebe o e-mail de aviso e `retentionWarnedAt` é gravado.
2. **Given** o mesmo candidato que entra 10 dias depois do aviso, **Then** `lastActiveAt` renova e
   `retentionWarnedAt` zera; a varredura não apaga.
3. **Given** conta avisada há 31 dias sem nenhum acesso, **When** a varredura roda (enforce ligado),
   **Then** a conta é excluída como na 006 (banco e bucket).
4. **Given** candidato inativo mas com candidatura em andamento, **Then** a conta não é tocada.
5. **Given** recrutador ou administrador inativo, **Then** nada acontece (D6).

### User Story 3 — Falhas não apagam por engano (Priority: P1)

1. **Given** o envio do aviso falha, **Then** `retentionWarnedAt` não é gravado e nada é apagado.
2. **Given** falha ao apagar o objeto do bucket, **Then** o banco segue e a falha é logada sem dado
   pessoal (`logSafeError`), como na 006.
3. **Given** erro numa candidatura do lote, **Then** as outras seguem e a execução devolve
   `{ warned, deleted, failed }`.
4. **Given** chamada sem `Authorization: Bearer $CRON_SECRET`, **Then** 401.

### User Story 4 — O candidato sabe o prazo (Priority: P2)

1. **Given** `/privacidade`, **Then** mostra a tabela de prazos aprovada.
2. **Given** `GET /api/me/data-export`, **Then** cada candidatura traz `retentionDeleteAt`.

### User Story 5 — Limpeza do que já venceu (Priority: P3)

1. **Given** `PasswordResetToken` vencido há 8 dias e `RateLimit` vencido há 8 dias, **When** a
   varredura roda, **Then** ambos somem.
2. **Given** `CodeDraft` de teste enviado há 31 dias, **Then** é apagado.

---

## Requisitos

- **FR-1201** Constantes dos prazos em um só arquivo `src/lib/retention.ts` (meses/dias de cada
  linha da tabela). Mudar um prazo é mudar uma constante; nenhum número solto em outro lugar.
- **FR-1202** `User` ganha `lastActiveAt DateTime` (padrão `now()`; preenchido com `updatedAt` nas
  linhas antigas) e `retentionWarnedAt DateTime?`. `Application` ganha `retentionWarnedAt
  DateTime?`. O login bem-sucedido atualiza `lastActiveAt` no máximo uma vez por dia e zera
  `retentionWarnedAt`.
- **FR-1203** Tabela `RetentionStat` (mês, `jobId?`, situação final, `rejectionReason?`, tipo da
  última etapa, `count`, `sumDays`, `sumMatchScore`, `matchScoreCount`); sem qualquer coluna que
  aponte para pessoa. Único por (mês, jobId, situação, motivo, etapa).
- **FR-1204** `src/server/retention/sweep.ts` com `runRetentionSweep({ enforce })`: acha
  candidaturas e contas vencidas, avisa, apaga quem já foi avisado há ≥ 30 dias, limpa tokens e
  rascunhos vencidos. Máximo 100 itens por execução. Devolve `{ warned, deleted, failed }`.
- **FR-1205** Antes de apagar uma candidatura, gravar/somar `RetentionStat` na **mesma transação**
  do apagamento (ou os dois, ou nenhum).
- **FR-1206** O apagamento reaproveita a lógica de `deleteMyAccount` (extraída sem a confirmação).
  Currículo só é removido do bucket se nenhuma candidatura restante o referencia.
- **FR-1207** E-mail de aviso em `src/server/email/templates/retention-notice.ts` (mesmo
  `renderEmailLayout`), em português simples, sem dado além do nome e do que será apagado.
  Sem `retentionWarnedAt` gravado → nunca apaga.
- **FR-1208** Rota `GET|POST /api/internal/retention`, protegida por `authorizedCron`, que chama
  `runRetentionSweep`. Agendada em `vercel.json` (1 execução por dia, em horário diferente da
  `expire`).
- **FR-1209** `RETENTION_ENFORCE` (padrão `false`) documentada em `.env.example` e em
  `docs/deploy-vercel.md`. Desligada: avisa e loga, não apaga.
- **FR-1210** `exportMyData` acrescenta `retentionDeleteAt` por candidatura. `RetentionStat` não
  entra.
- **FR-1211** `/privacidade` (006, FR-307) passa a exibir a tabela de prazos aprovada.
- **FR-1212** Logs da varredura sem dado pessoal: só contagens e ids internos de candidatura
  (`logSafeError` para erros).
- **FR-1213** Recrutador e administrador nunca entram na varredura de contas (D6).
- **NFR-1201** Execução idempotente e limitada (100 itens); tempo de uma função Hobby.
- **NFR-1202** Nada de código novo no `main` apagando dado antes de o orientador confirmar os
  prazos: até lá, `RETENTION_ENFORCE=false` em produção.

---

## Migration

**Precisa de migration**: colunas `User.lastActiveAt`, `User.retentionWarnedAt`,
`Application.retentionWarnedAt` e a tabela nova `RetentionStat`.

- A migration **liga o RLS** na tabela nova, como a da 009:
  `ALTER TABLE "RetentionStat" ENABLE ROW LEVEL SECURITY;`. As colunas novas entram em tabelas que
  já têm RLS.
- Backfill: `lastActiveAt = updatedAt` nas contas existentes (não `now()`, para não dar prazo
  grátis de 24 meses a quem sumiu há anos).
- Em produção o build aplica a migration **sozinho** no deploy (`scripts/migrate-production.mjs`,
  PRs #17 e #18). Por isso ela precisa rodar **limpa num banco local antes do merge** e ligar o RLS
  nas tabelas novas. O combinado 4 de `DIVISAO-EQUIPE.md` (aplicar à mão) ficou desatualizado.
- Gera conflito de `schema.prisma` com 010 (não mexe), 009 e 011: seguir o combinado 3 (atualizar
  com o `main`; se o schema mudou, apagar e regerar a própria migration).

## Onde mexe

- `prisma/schema.prisma` + `prisma/migrations/…_prazo_de_guarda`
- Novo `src/lib/retention.ts`, `src/server/retention/sweep.ts`,
  `src/server/email/templates/retention-notice.ts`
- `src/server/candidates/privacy.ts` (extrair o miolo da exclusão; `retentionDeleteAt` no export)
- Nova rota `src/app/api/internal/retention/route.ts` e `vercel.json` (novo cron)
- Callback de login (`lastActiveAt`) — `src/server/auth/**`, só a atualização
- Página `/privacidade`, `.env.example`, `docs/deploy-vercel.md`

**Não mexe**: `src/server/matching/**`, `Evaluation` (o trigger fica como está), telas do recrutador.

## Fora do escopo

- Plano pago da Vercel (execução mais de uma vez por dia).
- Ajustar os indicadores da 010 para somar `RetentionStat` ao histórico vivo.
- Anonimização campo a campo de currículo, código ou texto livre.
- Exclusão de recrutador/administrador; rotação da `ENCRYPTION_KEY`.
- Apagar cópia de e-mail no provedor (D5) e backups do banco/Supabase (política do fornecedor;
  citar no aviso de privacidade).
- Banco de talentos e convite para vaga nova (próxima rodada do Cassiano) — depende de P2.
- Tela para o RH ver ou editar prazos; "legal hold" (reter por ordem judicial).

## Testes

- **Unitário**: cálculo de vencimento por tipo de dado (`retention.ts`) nas bordas (exatos 12
  meses, 12 meses menos 1 dia); agregação para `RetentionStat` (soma, média, regra do mínimo).
- **Integração** (`tests/integration/retention.test.ts`): cenários das US1–US3 e US5 com datas
  forjadas no banco; nenhuma linha referencia o id apagado (como SC-303 da 006); objeto do bucket
  removido (mock do storage); aviso falho não apaga; recrutador intacto; rota sem `CRON_SECRET`
  dá 401; duas execuções seguidas não duplicam `RetentionStat`; `enforce=false` não apaga.
- **Integração (RLS)**: `RetentionStat` com RLS ligado (consulta ao catálogo do Postgres).
- **Integração**: `exportMyData` traz `retentionDeleteAt` e não traz `RetentionStat`.
- **E2E**: não necessário (rota de cron, sem tela nova além do texto de `/privacidade`).

---

## Success Criteria

- **SC-1201**: Com o enforce ligado, dados vencidos e avisados desaparecem do banco e do bucket
  em até um dia depois do aviso completar 30 dias.
- **SC-1202**: Nenhuma conta, candidatura ou arquivo é apagado sem `retentionWarnedAt` gravado.
- **SC-1203**: `RetentionStat` não permite, por nenhuma coluna, chegar a uma pessoa.
- **SC-1204**: `/privacidade` e o aviso por e-mail dizem os mesmos prazos que `retention.ts`.

---

## Perguntas para o orientador

1. **P1 — Os prazos.** 12 meses para candidatura reprovada/desistida, 24 meses para conta inativa e
   6 meses para currículo antigo estão razoáveis, ou a banca/o cliente espera outros números?
2. **P2 — Banco de talentos.** O cliente (3aq) quer guardar candidatos reprovados para vagas
   futuras? Se sim, isso precisa de **novo consentimento** (a base atual é "procedimento preliminar
   a contrato", art. 7º V) e de prazo próprio. Sem resposta, o banco de talentos da próxima rodada
   fica limitado ao que o prazo de 12 meses deixa.
3. **P3 — Candidatura aprovada.** Guardar 24 meses no CLTech faz sentido, ou, depois da
   contratação, o dado deve sair da plataforma logo e ficar só no RH da empresa?
4. **P4 — Aviso.** 30 dias de antecedência por e-mail bastam, ou o orientador quer uma segunda
   lembrança perto do dia (exigiria uma segunda coluna e outro e-mail)?
5. **P5 — Estatística.** O total por mês e vaga, sem nenhum dado de pessoa, é aceito como "dado
   anonimizado" (art. 12)? E o mínimo de 5 candidaturas por linha para mostrar a vaga é adequado?
6. **P6 — Backups e provedores.** Basta citar no aviso de privacidade que o Supabase (backups) e o
   provedor de e-mail guardam cópias pela política deles, ou o orientador quer algo a mais?
7. **P7 — Nota automática.** Como a nota automática (`Evaluation`) é dado pessoal do candidato
   (decisão de 07/11, 009 FR-909), confirmar que ela segue o mesmo prazo da candidatura e não um
   prazo próprio maior para auditoria.
