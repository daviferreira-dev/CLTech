# Feature Specification: Fluxo Funcional das Telas — Candidato e Recrutamento (Sprint 3)

**Feature Branch**: `004-fluxo-funcional-telas`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Fluxo funcional das telas, principalmente do recrutamento e
para o candidato que vai acessar essas vagas."

**Depende de**: `specs/003-identidade-visual/spec.md`. A 003 entrega os componentes que esta
spec usa (`EmptyState`, `ErrorState`, `Skeleton`, `Breadcrumb`, `ConfirmDialog`, `Pagination`,
`Badge` com os cinco estados de match) e o `AppShell`. A 003 define *como se parecem*; esta
define *quando aparecem e para onde levam*. Ordem de execução em `specs/ORDEM-EXECUCAO.md`.

---

## Escopo

Em escopo: navegação entre rotas, guardas de acesso por papel, destino de cada ação,
retorno ao contexto de origem, tradução dos códigos de erro da API em próximo passo
acionável, e estados terminais de cada tela.

Fora de escopo: contratos de API, regras de negócio, cálculo de match, schema Prisma. Os
códigos de erro, status e tipos de etapa citados aqui são os que o backend **já** devolve —
esta spec apenas define o que a tela faz com cada um. Nenhum código novo é inventado.

**Vocabulário fixo do sistema** (fonte: `src/lib/processStages.ts`, `src/server/**`):

- Etapas: `RESUME_ANALYSIS`, `CODE_TEST`, `GITHUB_ANALYSIS`, `HR_INTERVIEW`,
  `TECH_INTERVIEW`, `FINAL_OFFER`.
- Status de candidatura: `IN_PROGRESS`, `APPROVED`, `REJECTED`, `WITHDRAWN`.
- Status de vaga: `DRAFT`, `PUBLISHED`, `CLOSED`.
- Erros de candidatura: `RESUME_REQUIRED`, `ALREADY_APPLIED`, `JOB_NOT_OPEN`,
  `APPLICATION_CLOSED`.
- Erros de vaga (recrutador): `INCOMPLETE_JOB`, `ALREADY_PUBLISHED`, `JOB_LOCKED`.
- Match: `CALCULATED`, `NEEDS_RESUME`, `NOT_CALCULATED`, `NOT_AVAILABLE_YET`, `FAILED`.

---

## Mapa de rotas e papéis

| Rota | Papel exigido | Entrada vem de | Saídas |
|---|---|---|---|
| `/` | público | externo | `/vagas`, `/entrar` |
| `/entrar` | público | guarda de rota, `/cadastro` | `callbackUrl` ou `destinationForRole` |
| `/cadastro` | público | `/entrar` | `/entrar` ou sessão criada |
| `/vagas` | público | header, pós-login candidato | `/vagas/[id]`, `/perfil` |
| `/vagas/[id]` | público | `/vagas`, `/candidaturas` | candidatar, `/perfil`, `/entrar` |
| `/perfil` | CANDIDATE | header, bloqueio de candidatura | volta à vaga de origem |
| `/candidaturas` | CANDIDATE | header, pós-candidatura | `/vagas/[id]`, `/vagas` |
| `/recrutamento` | RECRUITER/ADMIN | pós-login recrutador | vagas, candidatos, vaga específica |
| `/recrutamento/vagas` | RECRUITER/ADMIN | painel | `nova`, `[id]`, `[id]/candidaturas` |
| `/recrutamento/vagas/nova` | RECRUITER/ADMIN | painel, lista de vagas | `[id]` após criar |
| `/recrutamento/vagas/[id]` | RECRUITER/ADMIN | lista, painel | `[id]/candidaturas` |
| `/recrutamento/vagas/[id]/candidaturas` | RECRUITER/ADMIN | vaga, painel (por etapa) | `[applicationId]` |
| `/…/candidaturas/[applicationId]` | RECRUITER/ADMIN | lista de candidaturas, busca | decisão, currículo |
| `/recrutamento/candidatos` | RECRUITER/ADMIN | header | `[applicationId]` |

**Regra de guarda (FR-G)**: toda rota protegida que receber sessão ausente redireciona para
`/entrar?callbackUrl=<rota atual completa, com query>`; toda rota protegida que receber
sessão de papel errado redireciona para `destinationForRole(role)` — candidato para
`/vagas`, recrutador para `/recrutamento`. Nunca mostra 403 em branco.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Candidato descobre uma vaga e chega ao detalhe (Priority: P1)

O candidato entra, vê vagas filtráveis com seu percentual de match, e abre a que interessa.

**Independent Test**: logar como candidato com currículo vigente, filtrar por `REMOTE` +
`SENIOR`, abrir o primeiro resultado, e confirmar que o detalhe é da mesma vaga do cartão.

**Acceptance Scenarios**:

1. **Given** um candidato recém-autenticado, **When** a sessão é criada sem `callbackUrl`,
   **Then** ele cai em `/vagas`.
2. **Given** `/vagas` com filtros e página aplicados, **When** o candidato abre uma vaga e
   usa o voltar do navegador, **Then** o mesmo recorte continua valendo — `q`, `technology`,
   `workMode`, `seniority`, `page` e `pageSize` vivem na URL, não em `useState`. Esses seis
   são exatamente os parâmetros de `jobListQuerySchema`; nenhum outro é introduzido.
3. **Given** uma vaga com match `CALCULATED`, **When** o cartão renderiza, **Then** exibe o
   percentual; **Given** match `NEEDS_RESUME`, **Then** exibe convite a completar o perfil
   com link para `/perfil`; **Given** `NOT_CALCULATED` ou `NOT_AVAILABLE_YET`, **Then**
   exibe "calculando" sem bloquear a candidatura; **Given** `FAILED`, **Then** omite o
   percentual sem mensagem de erro técnica.
4. **Given** um visitante não autenticado, **When** abre `/vagas`, **Then** vê as vagas
   `PUBLISHED` sem nenhum percentual, e as ações de conta são Entrar/Cadastrar.
5. **Given** a API de vagas falhando, **When** `/vagas` carrega, **Then** exibe erro com
   retentativa e mantém a navegação do header funcional.

---

### User Story 2 — Candidato se candidata, com todos os bloqueios tratados (Priority: P1)

Cada motivo de recusa da candidatura vira um próximo passo claro, nunca um beco.

**Independent Test**: tentar candidatar-se sem currículo, ser levado a `/perfil`, enviar o
currículo, voltar e concluir a candidatura sem navegar manualmente.

**Acceptance Scenarios**:

1. **Given** um visitante não autenticado em `/vagas/[id]`, **When** aciona candidatar-se,
   **Then** vai para `/entrar?callbackUrl=/vagas/[id]` e, autenticado, volta à mesma vaga.
2. **Given** um candidato sem currículo vigente, **When** a candidatura retorna
   `RESUME_REQUIRED`, **Then** a tela explica o que falta e oferece ir a
   `/perfil?next=/vagas/[id]`; ao salvar o currículo lá, a tela oferece retornar à vaga.
3. **Given** `ALREADY_APPLIED`, **When** o erro chega, **Then** a ação vira estado
   "Candidatura enviada" com link para a candidatura correspondente em `/candidaturas`, em
   vez de repetir o botão.
4. **Given** `JOB_NOT_OPEN` (vaga saiu do ar entre o carregamento e o clique), **When** o
   erro chega, **Then** a tela informa que a vaga não está mais aberta e leva de volta a
   `/vagas`.
5. **Given** uma candidatura bem-sucedida, **When** a resposta chega, **Then** o candidato é
   levado a `/candidaturas` com a nova candidatura identificável — não fica parado na vaga
   com apenas um texto de sucesso.
6. **Given** a requisição de candidatura em voo, **When** o candidato clica de novo,
   **Then** nada é reenviado: a ação fica desabilitada até a resposta.

---

### User Story 3 — Candidato acompanha a candidatura (Priority: P1)

`/candidaturas` responde, por candidatura: em que etapa estou, qual o status, e o que faço
agora.

**Independent Test**: com uma candidatura `IN_PROGRESS` em `TECH_INTERVIEW`, abrir
`/candidaturas` e chegar ao detalhe da vaga em um clique.

**Acceptance Scenarios**:

1. **Given** candidaturas existentes, **When** a lista renderiza, **Then** cada item mostra
   vaga, empresa, data de candidatura, status e a etapa atual posicionada dentro do pipeline
   completo daquela vaga — a etapa sozinha não diz quanto falta.
2. **Given** status `APPROVED`, **Then** o item aparece em tom positivo e informa que o
   processo foi concluído; **Given** `REJECTED`, **Then** informa o encerramento sem expor
   score nem justificativa interna do recrutador; **Given** `WITHDRAWN`, **Then** aparece
   como retirada pelo candidato.
3. **Given** nenhuma candidatura, **When** a lista renderiza, **Then** o estado vazio leva a
   `/vagas`.
4. **Given** um recrutador acessando `/candidaturas`, **When** a rota resolve, **Then** ele
   é redirecionado a `/recrutamento` (comportamento atual preservado).
5. **Given** qualquer item da lista, **When** acionado, **Then** abre `/vagas/[id]` da vaga
   correspondente.

---

### User Story 4 — Recrutador cria vaga e monta o pipeline até publicar (Priority: P1)

Do painel vazio até uma vaga `PUBLISHED` visível ao candidato, sem adivinhar o que falta.

**Independent Test**: criar vaga, montar pipeline de três etapas em ordem definida,
publicar, e vê-la aparecer em `/vagas` com aquele pipeline.

**Acceptance Scenarios**:

1. **Given** um recrutador recém-autenticado, **When** a sessão é criada, **Then** cai em
   `/recrutamento`; **Given** nenhuma vaga cadastrada, **Then** o painel mostra estado vazio
   com ação direta de criar a primeira vaga.
2. **Given** `/recrutamento/vagas/nova`, **When** o recrutador monta o pipeline, **Then**
   escolhe entre as seis etapas de `STAGE_TYPES`, define a ordem explicitamente, e a ordem
   exibida é a ordem que será persistida.
3. **Given** uma vaga salva sem os dados mínimos, **When** o recrutador tenta publicar e a
   API retorna `INCOMPLETE_JOB`, **Then** a tela aponta exatamente o que falta e mantém o
   rascunho intacto.
4. **Given** `ALREADY_PUBLISHED`, **When** o erro chega, **Then** a tela recarrega o estado
   da vaga e mostra-a como publicada, sem oferecer publicar de novo.
5. **Given** `JOB_LOCKED` (vaga com candidaturas em andamento), **When** o recrutador tenta
   alterar o pipeline, **Then** a tela explica que o pipeline está travado e quais campos
   ainda podem ser editados.
6. **Given** uma vaga publicada, **When** o recrutador volta à lista, **Then** ela aparece
   com status `PUBLISHED`, contagem de candidaturas e atalho para suas candidaturas.
7. **Given** a saída da criação com alterações não salvas, **When** o recrutador navega para
   fora, **Then** há confirmação antes de descartar.

---

### User Story 5 — Recrutador triaga candidaturas de uma vaga (Priority: P1)

Do painel à decisão sobre um candidato, sem perder de vista de qual vaga e de qual etapa se
trata.

**Independent Test**: a partir de um número de candidatos em `TECH_INTERVIEW` no painel,
chegar à lista já filtrada por essa etapa e abrir um relatório.

**Acceptance Scenarios**:

1. **Given** o painel com contagem por etapa, **When** o recrutador aciona uma contagem,
   **Then** abre `/recrutamento/vagas/[id]/candidaturas` já restrita àquela etapa, com o
   recorte visível e removível.
2. **Given** a lista de candidaturas de uma vaga, **When** renderiza, **Then** cada linha
   traz candidato, match, etapa atual, status e tempo na etapa, e o título da vaga permanece
   fixo no topo.
3. **Given** o relatório de uma candidatura, **When** abre, **Then** traz o caminho completo
   de volta (Painel › Vaga › Candidaturas › Candidato), o detalhamento de match com
   tecnologias encontradas e não encontradas, acesso ao currículo e os dados do GitHub
   quando houver.
4. **Given** o currículo do candidato, **When** o recrutador o aciona, **Then** ele abre por
   download autenticado, sem tirar o recrutador do relatório.
5. **Given** a ação de avançar, **When** confirmada e a API aceita, **Then** a tela mostra a
   nova etapa atual; **Given** o candidato estava na última etapa, **Then** o status passa a
   `APPROVED` e a tela deixa isso explícito.
6. **Given** a ação de reprovar, **When** acionada, **Then** exige confirmação explícita
   antes do envio; confirmada, o status vira `REJECTED` e as ações de decisão somem.
7. **Given** `APPLICATION_CLOSED` (outro recrutador já decidiu), **When** o erro chega,
   **Then** a tela recarrega o estado real da candidatura em vez de insistir na ação.
8. **Given** uma decisão concluída, **When** o recrutador volta à lista, **Then** a lista
   reflete a decisão sem exigir recarregamento manual, e o recorte de etapa anterior é
   preservado.

---

### User Story 6 — Recrutador busca candidatos entre todas as vagas (Priority: P2)

A busca global de candidatos é uma segunda porta de entrada para o mesmo relatório.

**Independent Test**: buscar por uma tecnologia, abrir um resultado, decidir, e voltar à
busca com os termos preservados.

**Acceptance Scenarios**:

1. **Given** `/recrutamento/candidatos`, **When** o recrutador busca, **Then** os critérios
   ficam na URL e sobrevivem ao voltar do navegador.
2. **Given** um resultado, **When** acionado, **Then** abre o relatório da candidatura com
   breadcrumb de volta para a busca — não para a vaga, porque a origem foi a busca.
3. **Given** busca sem resultados, **Then** estado vazio sugere afrouxar critérios, sem
   zerar o que foi digitado.

---

### User Story 7 — Sessão expirada e falhas de rede em qualquer tela (Priority: P2)

**Acceptance Scenarios**:

1. **Given** uma sessão expirada, **When** qualquer ação autenticada retorna 401, **Then** o
   usuário vai a `/entrar?callbackUrl=<rota atual>` e retorna ao ponto onde estava —
   aproveitando o 401 limpo entregue no commit `d4ceaa2`.
2. **Given** falha de rede em uma ação de escrita, **When** ela ocorre, **Then** a tela
   informa a falha e preserva o que o usuário digitou.
3. **Given** uma rota inexistente ou um recurso de outro usuário, **When** acessada,
   **Then** aparece uma tela de não encontrado com caminho de volta coerente com o papel.

---

## Requirements *(mandatory)*

- **FR-101**: Toda rota protegida MUST aplicar a regra de guarda (FR-G): sessão ausente →
  `/entrar?callbackUrl=<rota atual>`; papel errado → `destinationForRole(role)`.
- **FR-102**: Todo estado de lista que o usuário pode alterar (filtros, busca, recorte por
  etapa, paginação) MUST viver na query string, para sobreviver a voltar/compartilhar/recarregar.
- **FR-103**: Toda ação que falha com código conhecido da API MUST ser traduzida em um
  próximo passo acionável; nenhum código de erro cru chega à tela.
- **FR-104**: Toda ação de escrita MUST ser idempotente do ponto de vista da interface:
  desabilitada enquanto em voo, sem duplo envio possível.
- **FR-105**: Toda ação destrutiva ou irreversível (reprovar candidatura, publicar vaga,
  descartar rascunho, substituir currículo vigente, desconectar conta externa) MUST exigir
  confirmação explícita.
- **FR-106**: Toda rota com dois ou mais níveis MUST ter caminho de volta visível que
  reflita a origem real da navegação (vaga vs. busca de candidatos).
- **FR-107**: Após uma decisão ou candidatura concluída, a tela de origem MUST refletir o
  novo estado sem recarregamento manual.
- **FR-108**: Nenhuma tela de candidato MUST expor dado interno de triagem — score bruto de
  outros candidatos, notas do recrutador, ou motivo interno de reprovação.
- **FR-109**: Os cinco estados de match MUST ter tratamento de tela definido e distinto,
  conforme US1.3.
- **FR-110**: Nenhum contrato de API, payload ou código de erro MUST ser alterado por esta
  spec.

---

## Success Criteria *(mandatory)*

- **SC-101**: Um candidato novo completa cadastro → perfil com currículo → candidatura →
  acompanhamento usando apenas links da interface, sem digitar URL nem usar voltar.
- **SC-102**: Um recrutador novo completa criar vaga → pipeline → publicar → triar → decidir
  nas mesmas condições.
- **SC-103**: Cada código de erro listado no vocabulário tem um cenário de aceite
  correspondente e um teste E2E que o cobre.
- **SC-104**: Nenhuma tela do produto termina sem pelo menos uma saída acionável — incluindo
  estados vazios, de erro e de não encontrado.
- **SC-105**: Recarregar qualquer tela de lista após filtrar reproduz exatamente o mesmo
  recorte.
- **SC-106**: `pnpm test` e `pnpm test:e2e` verdes; nenhum arquivo sob `src/app/api`,
  `src/server` ou `prisma` alterado no diff.

---

## Riscos

- `JobDetail` hoje trata o resultado da candidatura por mensagem local; mudar para
  navegação ao concluir altera o que os testes E2E esperam ver — inventariar antes.
- `/candidaturas` é server component e não revalida sozinho após uma decisão do recrutador;
  o FR-107 exige decidir entre revalidação por rota ou recarregamento ao focar a aba.
- Filtros hoje em `useState` (`JobsList`) precisam migrar para query string (FR-102) sem
  disparar refetch em laço.
