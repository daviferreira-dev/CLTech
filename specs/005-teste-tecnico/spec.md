# Feature Specification: Teste Técnico de Código e Correção Automática (Sprint 3)

**Feature Branch**: `005-teste-tecnico`

**Created**: 2026-10-20

**Status**: Draft

**Input**: RF05 (candidato resolve desafio de código no ambiente da plataforma) e RF06
(correção automática da submissão), ambos agendados para a Sprint 3 em
`specs/001-portal-candidatura/contracts/api.md:155` e
`specs/002-painel-de-recrutamento/contracts/api.md:229`.

**Por que esta spec existe**: a etapa `CODE_TEST` já é selecionável no pipeline desde a
Sprint 2, mas não tem comportamento algum. Sem esta feature, uma vaga que escolhe
`CODE_TEST` trava o candidato numa etapa que nenhuma tela sabe executar. É a maior lacuna
funcional do fluxo de recrutamento.

**Relação com as outras specs da Sprint 3**: `003-identidade-visual` e
`004-fluxo-funcional-telas` tratam de telas que já existem. Esta spec **cria** telas e
rotas de API novas — é a única das três que altera `src/app/api`, `src/server` e `prisma`.
Ordem em `specs/ORDEM-EXECUCAO.md`.

---

## Estado atual do código

Já existe (criado vazio na Sprint 1, `prisma/schema.prisma`):

- `Challenge` — `title`, `statement`, `languages[]`, `difficulty`, `testCases` (Json, com
  `hidden` por caso), `timeLimitSeconds` (default 10, teto do RNF06).
- `CodeDraft` — rascunho com autosave, `testRunCount`, `@@unique([applicationId, challengeId])`.
- `CodeSubmission` — `executionStatus` (`QUEUED`/`RUNNING`/`COMPLETED`/…), `retryCount`,
  `submittedBy`, `@@unique([applicationId, challengeId])`.
- `Evaluation` — `type` inclui `CODE_TEST`, com `score` e `justification` (Json).
- `ProcessStage.config` — contrato previsto para `CODE_TEST`: `timeLimitMinutes`,
  `languages`, `difficulty`, `maxTestRuns`.

Não existe nenhuma rota, serviço ou tela. `src/app/api` tem apenas `auth`, `jobs`, `me`,
`recruiter`, `resumes`.

**Decisões já tomadas** (não reabrir): sandbox é **Judge0 em VM Oracle Cloud Always Free**,
nunca na Vercel (R10 — serverless não isola contêiner, CPU, memória nem rede, e o RNF06
exige as quatro). Código-fonte cifrado em repouso em `CodeDraft` e `CodeSubmission`
(Princípio I). Tentativa única por desafio (RN006). Uma retentativa automática apenas sobre
falha técnica (RF06-E1).

**Decisões pendentes que bloqueiam a implementação** (D5, prazo original 02/Nov):

- `maxTestRuns` — teto de execuções de teste antes da submissão final. Sugestão do D5: 20.
- Política de fila: 1 execução simultânea por candidato.

Sem esses dois números a VM única cai sob uso normal, não sob ataque. Precisam ser fechados
antes de começar a Fase B abaixo.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Recrutador configura a etapa de teste de código (Priority: P1)

Ao montar o pipeline, o recrutador que escolhe `CODE_TEST` define qual desafio aplicar, em
quais linguagens, com qual tempo limite.

**Independent Test**: criar vaga com `CODE_TEST`, configurar desafio e tempo, publicar, e
confirmar que a configuração é a que o candidato recebe.

**Acceptance Scenarios**:

1. **Given** o `JobBuilder` com a etapa `CODE_TEST` selecionada, **When** o recrutador a
   configura, **Then** escolhe um `Challenge` do catálogo, as linguagens permitidas (sempre
   um subconjunto de `Challenge.languages`) e o `timeLimitMinutes` — gravados em
   `ProcessStage.config`.
2. **Given** uma etapa `CODE_TEST` sem desafio escolhido, **When** o recrutador tenta
   publicar a vaga, **Then** a publicação falha com `INCOMPLETE_JOB` apontando a etapa.
3. **Given** uma vaga publicada com candidaturas em andamento, **When** o recrutador tenta
   trocar o desafio da etapa, **Then** a alteração é recusada — o pipeline já está travado
   (`JOB_LOCKED`), e trocar o desafio no meio invalidaria as submissões já feitas.
4. **Given** o enunciado de um desafio, **When** exibido ao recrutador, **Then** os casos de
   teste com `hidden: true` não são exibidos — eles nunca saem do servidor, nem para o
   recrutador.

---

### User Story 2 — Candidato resolve o desafio (Priority: P1)

O candidato cuja candidatura chega à etapa `CODE_TEST` abre o desafio, escreve código,
executa contra os casos visíveis e submete uma vez.

**Independent Test**: avançar uma candidatura até `CODE_TEST`, resolver o desafio, executar
três vezes, submeter, e confirmar que a segunda submissão é recusada.

**Acceptance Scenarios**:

1. **Given** uma candidatura cuja etapa atual é `CODE_TEST`, **When** o candidato abre
   "Desafios Técnicos", **Then** vê o desafio pendente com título, dificuldade, linguagens
   permitidas e tempo limite — e nenhum outro desafio de outra candidatura.
2. **Given** uma candidatura em qualquer outra etapa, **When** o candidato tenta abrir o
   desafio por URL direta, **Then** recebe `NOT_AVAILABLE_YET` e volta para
   `/candidaturas` — o acesso é derivado da etapa atual, nunca de link adivinhado.
3. **Given** o desafio aberto pela primeira vez, **When** a tela carrega, **Then** o
   cronômetro começa a contar a partir de `CodeDraft.startedAt`, que é gravado no servidor —
   recarregar a página não reinicia o tempo.
4. **Given** o candidato escrevendo código, **When** ele para de digitar, **Then** o
   rascunho é salvo automaticamente em `CodeDraft` (código cifrado), e reabrir a tela em
   outro dispositivo recupera o último estado salvo.
5. **Given** o candidato executando o código contra os casos visíveis, **When** a execução
   retorna, **Then** ele vê resultado por caso visível, e `testRunCount` é incrementado.
   Casos `hidden` nunca aparecem, nem antes nem depois da submissão.
6. **Given** `testRunCount` igual a `maxTestRuns`, **When** o candidato tenta executar de
   novo, **Then** a execução é recusada com a contagem restante explícita, e a submissão
   final continua disponível.
7. **Given** uma execução já em andamento para aquele candidato, **When** ele dispara
   outra, **Then** a segunda é enfileirada ou recusada — nunca duas simultâneas pelo mesmo
   candidato.
8. **Given** o candidato submetendo, **When** confirma, **Then** há confirmação explícita
   antes do envio, porque a tentativa é única (RN006), e após a submissão o editor passa a
   somente leitura.
9. **Given** uma submissão já existente para aquele `(applicationId, challengeId)`, **When**
   o candidato tenta submeter de novo, **Then** a segunda submissão é recusada — a garantia
   é a constraint única no banco, não apenas a tela.
10. **Given** o tempo limite esgotado sem submissão manual, **When** o prazo vence, **Then**
    o último `CodeDraft` salvo é submetido automaticamente com `submittedBy = SYSTEM`
    (RF05-A1), e o candidato é informado disso.

---

### User Story 3 — Correção automática da submissão (Priority: P1)

A submissão é corrigida contra todos os casos de teste, incluindo os ocultos, e vira uma
`Evaluation` que o recrutador lê.

**Independent Test**: submeter uma solução que passa nos casos visíveis e falha num oculto,
e confirmar que a nota reflete o conjunto completo.

**Acceptance Scenarios**:

1. **Given** uma submissão recebida, **When** ela é criada, **Then** entra com
   `executionStatus = QUEUED` e o candidato vê o estado de correção em andamento, sem ficar
   preso na tela.
2. **Given** a correção executando, **When** cada caso de teste roda, **Then** respeita
   `Challenge.timeLimitSeconds` (teto de 10s, RNF06) em contêiner descartável e sem rede.
3. **Given** a correção concluída, **When** o resultado é gravado, **Then** nasce uma
   `Evaluation` com `type = CODE_TEST`, `score` derivado da proporção de casos aprovados e
   `justification` registrando cada caso — identificando os ocultos por índice, nunca pelo
   conteúdo.
4. **Given** uma falha técnica do sandbox (indisponibilidade, timeout de infraestrutura),
   **When** ela ocorre, **Then** a submissão é reprocessada automaticamente **uma única
   vez** (`retryCount ≤ 1`, RF06-E1); persistindo a falha, a equipe técnica é notificada e a
   submissão fica em estado de falha visível ao recrutador.
5. **Given** um erro de compilação ou execução no código do candidato, **When** ele ocorre,
   **Then** **não** conta como falha técnica, não consome `retryCount`, e vira nota com a
   justificativa correspondente.
6. **Given** a correção concluída, **When** o recrutador abre o relatório da candidatura,
   **Then** vê nota, casos aprovados/reprovados, linguagem, tempo gasto e o código-fonte
   submetido.
7. **Given** qualquer resultado de correção, **When** gravado, **Then** a decisão de avançar
   ou reprovar continua sendo exclusivamente humana — o sistema nunca move a candidatura de
   etapa por conta da nota (Princípio II, já respeitado em `recordDecision`).

---

### User Story 4 — Catálogo de desafios (Priority: P2)

Alguém precisa cadastrar os desafios antes que qualquer vaga possa usá-los.

**Acceptance Scenarios**:

1. **Given** um administrador, **When** cadastra um desafio, **Then** informa enunciado,
   linguagens, dificuldade, tempo limite e os casos de teste marcando quais são ocultos.
2. **Given** um desafio já referenciado por alguma `ProcessStage`, **When** se tenta
   alterá-lo, **Then** a alteração dos casos de teste é recusada — mudaria a nota de
   submissões passadas. Cria-se um desafio novo.
3. **Given** o catálogo vazio, **When** o recrutador configura `CODE_TEST`, **Then** vê
   estado vazio explicando que nenhum desafio está disponível, em vez de um seletor vazio.

---

## Requirements *(mandatory)*

### Funcionais

- **FR-201**: Casos de teste com `hidden: true` MUST permanecer exclusivamente no servidor —
  jamais serializados em resposta de API, para candidato ou recrutador.
- **FR-202**: `CodeDraft.sourceCode` e `CodeSubmission.sourceCode` MUST ser cifrados em
  repouso, no mesmo padrão já usado em `Resume.extractedText`.
- **FR-203**: O acesso ao desafio MUST derivar da etapa atual da candidatura do próprio
  candidato autenticado; nenhuma rota aceita `challengeId` sem verificar a candidatura.
- **FR-204**: A unicidade da submissão MUST ser garantida pela constraint
  `@@unique([applicationId, challengeId])`, não só pela interface.
- **FR-205**: `retryCount` MUST incrementar apenas em falha de infraestrutura, nunca em erro
  do código do candidato, e MUST ser limitado a 1.
- **FR-206**: O cronômetro MUST ser autoritativo no servidor (`CodeDraft.startedAt` +
  `timeLimitMinutes`); o relógio do navegador é apenas exibição.
- **FR-207**: Execuções MUST respeitar `maxTestRuns` por candidato e 1 execução simultânea
  por candidato.
- **FR-208**: Toda execução MUST ocorrer em contêiner descartável, sem acesso à rede, com
  limite de CPU, memória e `timeLimitSeconds` — fora da Vercel (RNF06 / Princípio IV).
- **FR-209**: Nenhuma nota automática MUST alterar a etapa ou o status de uma candidatura.

### Não-funcionais

- **NFR-201**: A VM do sandbox precisa estar provisionada e acessível antes do início da
  implementação da correção; é dependência de infraestrutura, não de código.
- **NFR-202**: A indisponibilidade do sandbox MUST degradar graciosamente — candidato vê
  "correção em andamento", recrutador vê estado de falha; nenhuma tela quebra.
- **NFR-203**: As telas desta feature MUST usar o design system da spec 003 e as regras de
  fluxo da 004 desde o primeiro commit — não há repaginação posterior.

---

## Success Criteria *(mandatory)*

- **SC-201**: Uma vaga com `CODE_TEST` no pipeline leva o candidato do avanço de etapa até
  uma `Evaluation` gravada, sem intervenção manual.
- **SC-202**: Duas submissões para o mesmo par candidatura/desafio são impossíveis, provado
  por teste que tenta a segunda diretamente contra a API.
- **SC-203**: Nenhum caso oculto aparece em nenhuma resposta de API, provado por teste que
  inspeciona o corpo das respostas das rotas do desafio.
- **SC-204**: Tempo esgotado submete o último rascunho salvo, provado por teste com relógio
  controlado.
- **SC-205**: Falha de sandbox reprocessa uma vez e só uma vez.

---

## Dependências e riscos

- **Bloqueador**: D5 em aberto — `maxTestRuns` e política de fila. Sem número definido, a
  Fase B não começa.
- **Bloqueador**: provisionamento da VM Oracle Cloud com Judge0 (R10). É o item de maior
  prazo de toda a Sprint 3 e não depende de código.
- Esta é a única das três specs da Sprint 3 que altera API, domínio e schema. As asserções
  "nenhum arquivo em `src/app/api`, `src/server` ou `prisma` alterado" das specs 003 e 004
  valem para os commits daquelas specs, não para os desta.
- **RN005** (feedback automático por e-mail via Resend, D6) também está planejada para a
  Sprint 3 e **não** está coberta por nenhuma das quatro specs. Decidir se entra nesta
  sprint ou é adiada.
