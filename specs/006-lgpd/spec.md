# Feature Specification: Auditoria LGPD e Direitos do Titular (Sprint 3)

**Feature Branch**: `006-lgpd`

**Created**: 2026-10-20

**Status**: Draft

**Input**: Semana 16 do cronograma do ERS ("Testes e LGPD — execução dos casos de teste,
auditoria de criptografia"), `RNF05`, `RN004`, caso de teste `CT-RNF05`, Princípio I da
constituição, e duas pendências registradas em sprints anteriores:

- `specs/001-portal-candidatura/ers-divergences.md` D1 — "item obrigatório da auditoria de
  LGPD da Sprint 3".
- `specs/001-portal-candidatura/spec.md` — "o fluxo formal de exclusão de conta fica para
  uma sprint posterior". A Sprint 3 é a última do cronograma.

**Por que esta spec existe**: das quatro frentes da Sprint 3 no README (teste de código,
correção em sandbox, feedback e LGPD), três têm dono — 005 cobre as duas primeiras e o
RN005 foi adiado. LGPD não tem spec. O `CT-RNF05` do ERS tem três passos (HTTPS, cifra em
repouso, negação de acesso) e nenhum deles é verificado hoje por teste automatizado.

---

## Estado atual do código (auditoria de 20/10)

**Já atende**

- AES-256-GCM (`src/server/crypto.ts`) em `Candidate.phone`, `Resume.extractedText`,
  `CodeDraft.sourceCode`, `CodeSubmission.sourceCode` e no arquivo do currículo (cifrado
  antes do upload, `src/server/candidates/resume.ts`).
- Bucket privado; o currículo só sai pelo servidor, decifrado após a checagem de papel (`src/server/storage.ts`, `src/server/candidates/resume-access.ts`).
- Toda rota de API sensível chama `requireRole`/`requireSession`, que relê o papel do banco
  a cada acesso; toda página protegida chama `requirePageRole`.

**Achados**

| # | Achado | Gravidade | Tratamento |
|---|---|---|---|
| L1 | `Account.access_token`, `refresh_token` e `id_token` do OAuth (GitHub/LinkedIn) são gravados em texto claro pelo `PrismaAdapter`. Nenhum código os lê. | Alta — credencial de terceiro guardada sem finalidade | Não gravar (minimização, art. 6º III). |
| L2 | `toErrorResponse` faz `console.error(err)` do erro bruto. `PrismaClientValidationError` inclui na mensagem os argumentos da query — e-mail, nome, telefone em claro no log. Fere "Logs MUST NOT conter dado pessoal". | Alta | Logar classe, código e pilha, sem a mensagem. |
| L3 | A chave do objeto no bucket carrega o nome original do arquivo (`resumes/<id>/<uuid>-Joao_Silva_CV.pdf`). O nome do arquivo costuma ser o nome da pessoa. | Média | Chave só com UUID; o nome original segue em `Resume.originalFilename`, atrás do controle de acesso. |
| L4 | Nenhum cabeçalho força HTTPS. A Vercel redireciona HTTP→HTTPS, mas sem `Strict-Transport-Security` o primeiro acesso fica exposto a downgrade. | Média | HSTS + cabeçalhos de segurança em `next.config.ts`. |
| L5 | Não há como o titular obter seus dados nem excluir a conta (art. 18, II e VI). | Média | US4 e US5. |
| L6 | Não há aviso de privacidade (art. 9º — finalidade, forma e duração do tratamento). | Média | US6. |
| L7 | `.env.test.example` versiona a senha real do banco Supabase. | Registrada | Decisão consciente do dono, já documentada no próprio arquivo. Fora do escopo de código; rotacionar se o repositório virar público. |
| L8 | `Evaluation.score`/`justification` em texto claro, enquanto o Princípio I lista "resultados de avaliação" entre os dados a cifrar. | Registrada | Mesmo argumento do D1: `score` precisa ser ordenável para o ranking (RF07). Fica protegido por controle de acesso. Documentar no D1. |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Auditoria de cifra em repouso verificável (Priority: P1)

O avaliador executa o `CT-RNF05` passo 2 sem precisar abrir o banco à mão: um teste lê as
linhas cruas e prova que cada campo sensível está cifrado.

**Independent Test**: `pnpm test` — `tests/integration/lgpd-encryption.test.ts`.

**Acceptance Scenarios**:

1. **Given** um candidato com telefone, currículo, rascunho e submissão de código, **When**
   as colunas são lidas por SQL cru, **Then** cada uma começa com `v1:`, não contém o texto
   original e decifra de volta para ele.
2. **Given** um login por OAuth, **When** a conta é vinculada, **Then** `Account` não guarda
   `access_token`, `refresh_token` nem `id_token` (L1).
3. **Given** um upload de currículo chamado `Maria_Souza_CV.pdf`, **When** o objeto é
   gravado, **Then** a chave no bucket não contém o nome do arquivo (L3).

### User Story 2 — Negação de acesso provada por matriz (Priority: P1)

`CT-RNF05` passo 3: toda rota que expõe dado sensível recusa visitante (401) e candidato
(403) — provado por uma matriz única, para que uma rota nova sem guarda quebre a suíte.

**Independent Test**: `tests/integration/lgpd-access.test.ts`.

**Acceptance Scenarios**:

1. **Given** cada rota de `src/app/api/recruiter/**`, **When** chamada sem sessão, **Then**
   responde 401; **When** chamada por candidato, **Then** responde 403.
2. **Given** um currículo do candidato A, **When** o candidato B pede o download, **Then**
   recebe 403.
3. **Given** o arquivo de rotas em disco, **When** surge uma rota em `api/recruiter` que
   não está na matriz, **Then** o teste falha apontando a rota.

### User Story 3 — Transporte seguro e logs sem dado pessoal (Priority: P1)

**Acceptance Scenarios**:

1. **Given** qualquer resposta da aplicação, **Then** traz `Strict-Transport-Security`,
   `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `X-Frame-Options: DENY` (L4).
2. **Given** um erro inesperado cuja mensagem contém um e-mail, **When** a rota o converte
   em 500, **Then** o log não contém o e-mail (L2).

### User Story 4 — Candidato baixa os próprios dados (Priority: P2)

LGPD art. 18, II (acesso). Em `/perfil`, "Baixar meus dados" entrega um JSON com tudo o
que a plataforma guarda sobre a pessoa, decifrado.

**Acceptance Scenarios**:

1. **Given** um candidato autenticado, **When** pede a exportação, **Then** recebe JSON com
   conta, perfil (telefone decifrado), contas externas, snapshot do GitHub, metadados dos
   currículos, candidaturas com etapa e histórico, e o código que escreveu nos desafios.
2. **Given** a exportação, **Then** não contém `passwordHash`, ids de outros usuários nem
   casos de teste ocultos (FR-201).
3. **Given** um recrutador, **When** chama a rota, **Then** recebe 403 — a exportação é do
   titular candidato.

**Decisão desta spec**: notas automáticas (`Evaluation`) **não** entram na exportação. O
RN004 restringe relatórios a recrutador/administrador, e o ERS não define a revisão de
decisão automatizada (art. 20). Registrado como questão em aberto para a revisão do ERS.

### User Story 5 — Candidato exclui a própria conta (Priority: P2)

LGPD art. 18, VI (eliminação). Em `/perfil`, "Excluir minha conta" apaga todos os dados
pessoais — banco e bucket — e encerra a sessão.

**Acceptance Scenarios**:

1. **Given** um candidato com currículos e candidaturas, **When** confirma a exclusão
   digitando `EXCLUIR`, **Then** `User`, `Candidate` e tudo o que pende deles somem do banco,
   os objetos dos currículos somem do bucket, e a pessoa volta deslogada para a home.
2. **Given** a confirmação errada ou ausente, **Then** a API responde 422 e nada é apagado.
3. **Given** um cookie de sessão de conta já excluída, **When** usado, **Then** responde 401
   (comportamento já garantido por `requireSession`).
4. **Given** um recrutador ou administrador, **When** chama a exclusão, **Then** recebe 403 —
   contas internas têm vagas e decisões de etapa vinculadas e saem por processo
   administrativo, fora desta sprint.
5. **Given** falha ao apagar um objeto do bucket, **Then** a exclusão do banco segue mesmo
   assim e a falha é logada sem dado pessoal — a pessoa não fica presa a uma conta que pediu
   para eliminar por causa de um arquivo órfão cifrado.

**Decisão desta spec**: exclusão é **definitiva**, não anonimização. A imutabilidade do
score (RN003, trigger em `Evaluation`) impede *alterar* nota, não apagar a candidatura
inteira a pedido do titular.

### User Story 6 — Aviso de privacidade (Priority: P2)

LGPD art. 9º. Página pública `/privacidade`: quais dados, para quê, quem vê, por quanto
tempo, e como exercer os direitos (US4/US5). Linkada no rodapé e no cadastro.

---

## Requirements *(mandatory)*

### Funcionais

- **FR-301**: O vínculo OAuth MUST gravar só `provider`, `providerAccountId` e `type`;
  tokens descartados antes do INSERT (L1).
- **FR-302**: Logs de erro inesperado MUST NOT incluir a mensagem do erro; só nome, código
  (quando houver) e pilha (L2).
- **FR-303**: Chave de objeto do bucket MUST NOT conter texto fornecido pelo usuário (L3).
- **FR-304**: Toda resposta MUST incluir HSTS (`max-age` ≥ 1 ano) e os cabeçalhos da US3 (L4).
- **FR-305**: `GET /api/me/data-export` — só `CANDIDATE`, resposta com
  `Content-Disposition: attachment`.
- **FR-306**: `DELETE /api/me/account` com corpo `{ "confirmation": "EXCLUIR" }` — só
  `CANDIDATE`; apaga o banco numa transação e o bucket em melhor esforço.
- **FR-307**: Rota `/privacidade` pública, linkada no rodapé e em `/cadastro`.

### Não-funcionais

- **NFR-301**: Telas novas usam o design system da 003 e o `ConfirmDialog` da 004 para a
  exclusão.
- **NFR-302**: Nenhuma migração de schema — L1 e L3 valem para gravações novas. Linhas
  antigas de `Account` com token são limpas por um script único, não por migração.

---

## Success Criteria *(mandatory)*

- **SC-301**: Os três passos do `CT-RNF05` têm teste automatizado verde.
- **SC-302**: Uma rota nova em `api/recruiter` sem entrada na matriz quebra `pnpm test`.
- **SC-303**: Depois da exclusão, nenhuma linha do banco referencia o id do usuário excluído.
- **SC-304**: D1 do `ers-divergences.md` marcado como resolvido, com L8 incorporado.

---

## Fora de escopo

- Exclusão de recrutador/administrador; rotação da chave `ENCRYPTION_KEY`; registro de
  consentimento com versionamento (a base legal do tratamento é procedimento preliminar a
  contrato, art. 7º V, não consentimento); RN005 (adiado na execução da Sprint 3).
- Matriz de rastreabilidade e manual de execução (Semana 17) — entregáveis de documentação,
  não desta spec.
