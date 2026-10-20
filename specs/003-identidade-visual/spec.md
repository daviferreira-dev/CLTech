# Feature Specification: Identidade Visual e Fluxo das Telas (Sprint 3)

**Feature Branch**: `003-identidade-visual`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Estilização das telas seguindo o modelo visual das referências
(listagem de vagas e perfil do candidato). Apenas a identidade visual muda — todas as
funções existentes permanecem. Inclui a tela de perfil do usuário com todas as suas funções
e o fluxo funcional das telas, principalmente recrutamento e a jornada do candidato que
acessa as vagas."

## Escopo e não-escopo

**Em escopo**: camada de apresentação de todas as rotas já existentes em `src/app`
(`(public)`, `(auth)`, `(candidate)`, `(recruiter)`), extração de um design system em
`src/components/ui`, tokens no `tailwind.config.ts`, shell de navegação compartilhado, e a
*aparência* dos estados de vazio, erro e carregamento.

**Fronteira com a spec 004**: o *comportamento* de navegação — para onde cada ação leva,
guardas por papel, estado em query string, tradução de código de erro em próximo passo —
pertence exclusivamente a `specs/004-fluxo-funcional-telas/spec.md`. Esta spec entrega os
componentes (`EmptyState`, `ErrorState`, breadcrumb, confirmação) e a 004 decide quando e
para onde eles apontam. Nenhum critério de aceite de navegação deve ser duplicado aqui.

**Fora de escopo**: qualquer mudança em rotas de API (`src/app/api/**`), regras de negócio
(`src/server/**`), schemas de validação (`src/lib/validation/**`), Prisma schema, ou cálculo
de match. Nenhum endpoint muda de contrato. Nenhum campo de formulário é adicionado ou
removido: os formulários continuam enviando exatamente os mesmos payloads que enviam hoje.

**Regra-mãe desta sprint**: se uma alteração muda o que a tela *faz*, ela está fora de
escopo. Só muda o que a tela *parece* e por onde o usuário *chega até ela*.

---

## Elementos da referência sem lastro no sistema

As prints de referência contêm interface para funcionalidades que **não existem** no backend
atual. Estilizá-las criaria tela falsa ou exigiria mudança de API — ambas proibidas nesta
sprint. Decisão por elemento:

| Elemento da print | Situação no código | Decisão |
|---|---|---|
| Busca por cargo/tecnologia | `jobListQuerySchema` já aceita `q` e `technology` | **Entra** — a UI só não usava |
| Paginação | schema já aceita `page` e `pageSize` | **Entra** |
| "Desafios Técnicos" no menu | tabelas `Challenge`/`CodeDraft`/`CodeSubmission` existem e estão vazias; nenhuma rota ou tela | **Condicional** — pertence à spec `005-teste-tecnico` (RF05/RF06, mesma Sprint 3). O item entra no `AppHeader` quando a 005 entregar a rota; até lá fica fora. O componente de navegação deve aceitar o item sem refatoração. |
| Sino de notificações | nenhum modelo de notificação | **Fora** — removido do header |
| Faixa salarial, CLT/PJ, benefícios | ausentes no modelo `Job` | **Fora** dos filtros |
| Selos "Vaga Oficial" / "Contratação Imediata" | sem campo correspondente | **Fora** |
| "Score do seu perfil 94/100" | não existe score de perfil, só match por vaga | **Fora** |
| "Dados Extraídos do Currículo" (senioridade, área, inglês, formação, resumo) | só existe `Resume.extractedText` cifrado; nenhum campo estruturado | **Fora desta sprint** — vira backlog de feature, não de estilo |

Os tokens `warning-500` e o `Badge` variante `warning` permanecem definidos no design system
(uso legítimo em prazos e avisos de rascunho), mesmo sem os selos da print.

---

## Direção visual (derivada das referências)

### Tom

Produto de recrutamento técnico, denso em informação mas respirável. Fundo claro neutro,
superfícies brancas elevadas por borda sutil (não por sombra pesada), tipografia com
hierarquia forte no topo da página e peso médio nos cartões. Acento verde reservado para
sinal positivo — match da IA, status "conectado", selos de vaga verificada. Azul-marinho
escuro é a cor de ação primária e da marca.

### Tokens de cor

Definidos como CSS custom properties em `src/app/globals.css` e expostos no
`tailwind.config.ts` em `theme.extend.colors`. Nenhum componente deve escrever um hex
literal.

| Token | Valor | Uso |
|---|---|---|
| `brand-900` | `#0F172A` | logo, botão primário, texto de título |
| `brand-700` | `#1E293B` | hover do botão primário, header de tabela |
| `brand-100` | `#E2E8F0` | borda de campo, divisor |
| `accent-600` | `#059669` | selo de match, status conectado, selo "Vaga Oficial" |
| `accent-100` | `#D1FAE5` | fundo de selo/pill de match e dos filtros rápidos ativos |
| `surface` | `#FFFFFF` | cartões, painéis, barra de navegação |
| `canvas` | `#F8FAFC` | fundo da página (`body`) |
| `ink-900` | `#0F172A` | texto primário |
| `ink-600` | `#475569` | texto secundário, labels |
| `ink-400` | `#94A3B8` | placeholder, texto auxiliar |
| `danger-600` | `#DC2626` | erro de formulário, ação de reprovar |
| `warning-500` | `#D97706` | "Contratação Imediata", avisos de prazo |

Cada cor de texto sobre seu fundo previsto deve atingir contraste AA (4.5:1 para corpo,
3:1 para texto ≥ 18px). `ink-400` só pode ser usado em texto não essencial.

### Tipografia

Uma única família sans (a padrão do sistema via `font-sans`, sem webfont externa, para não
introduzir rede nova). Escala:

- `display` — 30px/36px, peso 700 — título da página ("Oportunidades Abertas na CLTech").
- `h2` — 20px/28px, peso 600 — título de seção de card ("Dados Básicos", "Currículo").
- `h3` — 16px/24px, peso 600 — título de vaga no cartão da lista.
- `body` — 14px/20px, peso 400 — corpo e descrição.
- `label` — 12px/16px, peso 500, `ink-600` — rótulo de campo e de filtro.
- `mono-tag` — 12px, peso 500 — chips de tecnologia.

### Forma e espaçamento

- Raio: `8px` em campos e botões, `12px` em cartões, `9999px` em chips, pills e selos.
- Borda: `1px solid brand-100` em toda superfície elevada; sombra apenas no header fixo
  (`0 1px 2px rgba(15,23,42,.06)`) e em popovers.
- Grade de espaçamento múltipla de 4px. Padding interno de cartão: 24px desktop, 16px
  mobile. Gap entre cartões de uma lista: 16px.
- Largura máxima de conteúdo: `1280px`, centralizada, com padding lateral de 24px (16px em
  mobile).

### Estados obrigatórios por componente

Todo componente interativo precisa dos cinco estados: `default`, `hover`, `focus-visible`
(anel de 2px em `brand-900` com offset 2px — nunca `outline: none` sem substituto),
`disabled` (opacidade 50%, cursor `not-allowed`), e `loading` quando dispara rede.

---

## Design system

Novos arquivos em `src/components/ui/`, todos server-safe salvo quando marcados `"use client"`:

`Button` (variantes `primary` / `secondary` / `ghost` / `danger`, tamanhos `sm` / `md`),
`Card` (+ `CardHeader`, `CardBody`), `Input`, `Select`, `Textarea`, `Field` (label + erro +
hint, associando `htmlFor`/`aria-describedby`), `Chip` (tecnologia, removível ou não),
`Badge` (`match` / `success` / `warning` / `neutral`), `Avatar`, `EmptyState`,
`ErrorState` (com ação de tentar de novo), `Skeleton`, `Pagination`, `Tabs`,
`FileDropzone`, `Breadcrumb`, `ConfirmDialog`.

Em `src/components/layout/`: `AppHeader` (logo, navegação principal, busca de vagas que
alimenta o parâmetro `q`, menu de usuário — sem sino de notificações, que não tem modelo),
`PageHeader` (título, subtítulo, ações), `SidebarFilters`, `AppShell`.

Nenhum desses componentes faz `fetch`. Dados continuam vindo dos containers atuais
(`JobsList`, `ProfileForm`, `Dashboard`, …), que passam a renderizar o design system no
lugar de classes Tailwind soltas.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Navegação consistente em todo o produto (Priority: P1)

Qualquer usuário autenticado vê o mesmo cabeçalho em toda tela, sabe em qual seção está, e
alcança perfil, vagas e candidaturas em um clique.

**Why this priority**: o shell é o que todas as outras telas herdam; sem ele, cada tela
continua sendo uma ilha com estilo próprio.

**Independent Test**: logar como candidato, percorrer vagas → detalhe → candidaturas →
perfil, e confirmar que o cabeçalho permanece, com o item da seção atual destacado.

**Acceptance Scenarios**:

1. **Given** um candidato autenticado, **When** ele abre qualquer rota de `(candidate)` ou
   `(public)`, **Then** vê o `AppHeader` com Vagas Disponíveis, Minhas Candidaturas e Meu
   Perfil; "Desafios Técnicos" aparece somente depois que a spec `005-teste-tecnico`
   entregar a rota correspondente. O item correspondente à rota atual fica destacado.
2. **Given** um recrutador autenticado, **When** ele abre qualquer rota de `(recruiter)`,
   **Then** vê o mesmo `AppHeader`, porém com a navegação de recrutamento (Painel, Minhas
   Vagas, Candidatos — os três itens já presentes em `(recruiter)/recrutamento/layout.tsx`)
   e o menu de usuário exibindo nome, papel e avatar.
3. **Given** um visitante não autenticado, **When** ele abre a listagem pública de vagas,
   **Then** vê o cabeçalho sem menu de usuário e com as ações Entrar e Cadastrar.
4. **Given** qualquer usuário em viewport de 360px, **When** a tela carrega, **Then** a
   navegação colapsa em menu acionável por botão e nenhum conteúdo gera rolagem horizontal.
5. **Given** um usuário navegando por teclado, **When** ele pressiona Tab a partir do topo,
   **Then** o primeiro foco é um link "Pular para o conteúdo" e todos os itens de navegação
   têm anel de foco visível.

---

### User Story 2 — Tela de vagas no novo padrão, com todas as funções atuais (Priority: P1)

O candidato abre a listagem de vagas e encontra o mesmo conteúdo de hoje — filtros,
percentual de match, tecnologias, link para o detalhe — reorganizado no layout da
referência: cabeçalho da página, barra de busca com filtros, coluna lateral de refino e
lista de cartões.

**Why this priority**: é a porta de entrada do candidato e a tela mais vista do produto.

**Independent Test**: candidato com currículo vigente abre `/vagas`, aplica um filtro de
modalidade e um de senioridade, e vê a lista filtrada em cartões com selo de match; o
comportamento é idêntico ao atual, apenas repaginado.

**Acceptance Scenarios**:

1. **Given** a listagem de vagas, **When** a página renderiza, **Then** exibe um
   `PageHeader` com título, subtítulo e a contagem de vagas ativas devolvida pela API.
2. **Given** os filtros da listagem, **When** o candidato os altera, **Then** a lista é
   refeita usando apenas parâmetros que `jobListQuerySchema` já aceita — `q`, `technology`,
   `workMode`, `seniority`, `page`, `pageSize`. Nenhum filtro sem contrapartida no schema
   (faixa salarial, vínculo, benefícios) é renderizado.
3. **Given** uma vaga com match calculado, **When** o cartão renderiza, **Then** o
   percentual aparece como `Badge` variante `match` em `accent`, alinhado à direita do
   cartão.
4. **Given** um candidato sem currículo vigente, **When** o cartão renderiza, **Then** no
   lugar do selo aparece a orientação para completar o perfil, com link direto para
   `/perfil`.
5. **Given** a API de vagas falhando, **When** a página carrega, **Then** aparece um
   `ErrorState` com mensagem e botão de tentar de novo — e a página não quebra (preserva o
   comportamento conquistado no commit `6f1dc6a`).
6. **Given** nenhuma vaga correspondendo aos filtros, **When** a lista renderiza, **Then**
   aparece um `EmptyState` com ação de limpar filtros.
7. **Given** a lista carregando, **When** a resposta ainda não chegou, **Then** são exibidos
   `Skeleton`s de cartão, não um espaço em branco.

---

### User Story 3 — Perfil do candidato completo no novo padrão (Priority: P1)

O candidato abre Meu Perfil e vê, em cartões empilhados, todas as funções que já existem
hoje: cabeçalho de identidade, dados básicos, contas externas, currículo e os dados
extraídos do currículo.

**Why this priority**: o perfil alimenta o match; é também a tela com mais funções distintas
por pixel, logo a que mais se beneficia da padronização.

**Independent Test**: candidato abre `/perfil`, edita um campo de dados básicos, salva,
conecta uma conta externa, envia um currículo, e confirma que cada ação produz o mesmo
resultado de hoje, com feedback visual no novo padrão.

**Acceptance Scenarios**:

1. **Given** o perfil carregado, **When** a página renderiza, **Then** o topo mostra
   `Avatar`, nome, cargo/senioridade e os chips das principais tecnologias do candidato.
2. **Given** o cartão "Dados Básicos", **When** renderiza, **Then** contém exatamente os
   campos atuais — Nome Completo, E-mail (somente leitura), Telefone, Endereço
   (Cidade/Estado) — em grade de duas colunas no desktop e uma coluna em mobile.
3. **Given** o cartão "Conecte suas contas", **When** renderiza, **Then** mostra um bloco
   por provider de `PROVIDERS` (GitHub, LinkedIn, Lattes) com ícone, nome, status atual
   (`PENDING`, `CONNECTED`, `UNAVAILABLE`, `DISCONNECTED`) e a ação correspondente; status
   `CONNECTED` usa `accent-600`, `UNAVAILABLE` exibe o `unavailableReason` existente.
4. **Given** o cartão "Currículo", **When** não há currículo vigente, **Then** mostra o
   `FileDropzone` com os formatos e o limite de tamanho aceitos hoje; **When** há currículo
   vigente, **Then** mostra nome do arquivo, tamanho e as ações de baixar e substituir.
5. **Given** um erro de upload de currículo, **When** ele ocorre, **Then** a mensagem de
   erro aparece ancorada ao dropzone, em `danger-600`, com `role="alert"`.
6. **Given** um currículo com `parseStatus` igual a `PARSED`, **When** o cartão de currículo
   renderiza, **Then** exibe o selo "Leitura Concluída" em `accent`; **Given** `FAILED`,
   **Then** exibe aviso de que o texto não pôde ser lido e que isso afeta o match. O cartão
   "Dados Extraídos do Currículo" das prints (senioridade, área, inglês, formação, resumo)
   **não é implementado** nesta sprint — esses campos não existem no modelo, só o
   `extractedText` cifrado.
7. **Given** o candidato salvando dados básicos, **When** a requisição está em voo, **Then**
   o botão fica em estado `loading` e desabilitado; ao concluir, uma mensagem de sucesso
   aparece e some sozinha, sem deslocar o layout.

---

### User Story 4 — Telas do candidato no novo padrão (Priority: P1)

Detalhe da vaga e Minhas Candidaturas adotam a identidade. *Para onde* cada ação leva é
definido na spec 004; aqui define-se apenas como essas telas se apresentam.

**Independent Test**: abrir `/vagas/[id]` e `/candidaturas` e confirmar que ambas usam
`AppShell`, `PageHeader`, `Card` e os componentes de estado, sem classe de cor crua.

**Acceptance Scenarios**:

1. **Given** o detalhe de uma vaga, **When** renderiza, **Then** mostra o pipeline de etapas
   como trilha ordenada usando `STAGE_LABEL`, e as tecnologias exigidas com marcação visual
   distinta entre encontradas e não encontradas.
2. **Given** o detalhe em viewport mobile, **When** renderiza, **Then** a ação principal de
   candidatar-se fica fixada em barra inferior, sem cobrir conteúdo ao rolar até o fim.
3. **Given** a ação de candidatar-se indisponível (já candidatado, sem currículo, vaga
   fechada), **When** renderiza, **Then** usa um estado visual próprio do `Button` em vez de
   sumir da tela — o texto exibido em cada caso é definido pela spec 004.
4. **Given** `/candidaturas`, **When** renderiza, **Then** cada candidatura é um `Card` com
   vaga, empresa, data, `Badge` de status e a etapa atual posicionada na trilha do pipeline.
5. **Given** `/candidaturas` sem itens, **When** renderiza, **Then** usa `EmptyState`.

---

### User Story 5 — Telas de recrutamento no novo padrão (Priority: P1)

Painel, vagas, construtor de pipeline, candidaturas, relatório e busca passam a falar a
mesma língua visual. O caminho entre elas é escopo da spec 004.

**Independent Test**: percorrer as seis telas de `(recruiter)` e confirmar uso uniforme de
`PageHeader`, `Card`, `Badge` e componentes de estado.

**Acceptance Scenarios**:

1. **Given** o painel, **When** renderiza, **Then** apresenta os indicadores já devolvidos
   pelo endpoint de dashboard como cartões de métrica uniformes.
2. **Given** a listagem de vagas do recrutador, **When** renderiza, **Then** cada vaga mostra
   título, `Badge` de status (`DRAFT`/`PUBLISHED`/`CLOSED`), número de candidaturas e as
   ações existentes agrupadas de forma consistente.
3. **Given** o `JobBuilder`, **When** o recrutador monta o pipeline, **Then** as etapas
   aparecem como lista ordenada com a ordem visível, limitadas a `STAGE_TYPES` — a camada
   visual não introduz etapa nova nem altera a lógica de ordenação existente.
4. **Given** a lista de candidaturas de uma vaga, **When** renderiza, **Then** o título da
   vaga fica no `PageHeader` e cada linha traz candidato, match, etapa atual e status.
5. **Given** o relatório de uma candidatura, **When** renderiza, **Then** traz o
   detalhamento de match já existente, acesso ao currículo e as ações avançar/reprovar —
   reprovar com variante `danger`.
6. **Given** a busca de candidatos, **When** renderiza, **Then** usa os mesmos campos de
   busca de hoje e devolve resultados em cartões com match e vaga de origem.
7. **Given** qualquer lista de recrutamento vazia, carregando ou com erro, **When**
   renderiza, **Then** usa `Skeleton`/`EmptyState`/`ErrorState` em vez de área em branco ou
   do texto "Carregando…" solto que existe hoje em `Dashboard` e `JobDetail`.

---

### User Story 6 — Entrar e cadastrar no novo padrão (Priority: P2)

Telas de autenticação adotam a identidade: painel centralizado, marca no topo, campos com
`Field`, erro de credencial legível.

**Independent Test**: tentar entrar com senha errada e ver a mensagem de erro no novo
padrão, depois entrar corretamente e cair na rota definida por `src/server/auth/redirect.ts`.

**Acceptance Scenarios**:

1. **Given** o formulário de login, **When** a credencial é inválida, **Then** o erro aparece
   em `danger-600`, com `role="alert"`, sem limpar o e-mail digitado.
2. **Given** o formulário de cadastro, **When** um campo falha na validação do Zod atual,
   **Then** a mensagem aparece sob o campo correspondente, sem alterar as regras de
   validação.
3. **Given** um login bem-sucedido, **When** a sessão é criada, **Then** o destino continua
   sendo o que a lógica de redirecionamento atual define — candidato para vagas, recrutador
   para o painel.

---

## Requirements *(mandatory)*

### Funcionais

- **FR-001**: Os tokens de cor, raio, sombra e tipografia MUST estar declarados uma única
  vez (`globals.css` + `tailwind.config.ts`) e consumidos por nome.
- **FR-002**: Nenhum componente de tela MUST conter cor hexadecimal literal nem classe de
  cor Tailwind crua fora dos tokens (`bg-slate-900`, `text-slate-500` e similares saem).
- **FR-003**: Toda tela autenticada MUST renderizar dentro do `AppShell`, com o item de
  navegação da seção atual marcado também via `aria-current="page"`.
- **FR-004**: Toda lista que consome API MUST ter os quatro estados: carregando
  (`Skeleton`), vazio (`EmptyState`), erro (`ErrorState` com retentativa) e preenchido.
- **FR-005**: Todo formulário MUST associar label e campo, expor erro por
  `aria-describedby`, e desabilitar a ação primária enquanto a requisição estiver em voo.
- **FR-006**: Os payloads, parâmetros de query e rotas chamados pelos containers MUST
  permanecer idênticos aos atuais; a sprint não altera nenhum contrato de API.
- **FR-007**: O perfil do candidato MUST preservar todas as funções atuais: editar dados
  básicos, conectar/desconectar cada provider externo, sincronizar conta externa, enviar e
  substituir currículo, baixar currículo, e revisar os dados extraídos.
- **FR-008**: O design system MUST fornecer os componentes `ConfirmDialog` e `Breadcrumb`
  acessíveis (foco preso no diálogo, fechamento por `Esc`, `nav` rotulado). *Quando* usá-los
  é definido por FR-105 e FR-106 da spec 004 — aqui só a existência e a aparência.
- **FR-009**: `Badge` variante `match` MUST cobrir os cinco estados que a API devolve:
  `CALCULATED` com a escala de cor de FR-010; `NEEDS_RESUME` como convite neutro;
  `NOT_CALCULATED` e `NOT_AVAILABLE_YET` como indicador de cálculo em andamento; `FAILED`
  sem selo algum. Nenhum estado pode cair em renderização indefinida.
- **FR-010**: Para `CALCULATED`, a escala visual MUST ser a mesma em todas as telas:
  `accent` para ≥ 80%, `neutral` para 50–79%, `ink-400` para < 50%.

### Não-funcionais

- **NFR-001**: Layout íntegro de 360px a 1280px, sem rolagem horizontal — mantendo a
  garantia já conquistada no commit `7c9cfdf`.
- **NFR-002**: Contraste AA em todo texto; foco visível em todo elemento focável; navegação
  completa por teclado nos fluxos das User Stories 4 e 5.
- **NFR-003**: Nenhuma dependência nova de runtime, nenhuma webfont remota, nenhuma
  biblioteca de componentes de terceiros. Tailwind + React, como hoje.
- **NFR-004**: Sem regressão nas suítes `pnpm test` e `pnpm test:e2e`; seletores de teste
  que dependem de texto visível devem continuar válidos — se um texto mudar, o teste
  correspondente é atualizado no mesmo commit.
- **NFR-005**: Respeitar `prefers-reduced-motion`; transições no máximo de 150ms e
  limitadas a cor, opacidade e transform.

---

## Success Criteria *(mandatory)*

- **SC-001**: Todas as rotas de `src/app` (exceto `api`) renderizam dentro do design system,
  sem classe de cor crua remanescente — verificável por varredura de `bg-slate-`,
  `text-slate-`, `border-slate-` no `src`.
- **SC-002**: As seis User Stories passam em teste manual nas larguras 360px, 768px e
  1280px.
- **SC-003**: `pnpm lint`, `pnpm test` e `pnpm test:e2e` verdes.
- **SC-004**: Nenhum arquivo sob `src/app/api`, `src/server` ou `prisma` modificado no diff
  da sprint — este é o critério objetivo de "só a identidade mudou".
- **SC-005**: Um usuário consegue completar o fluxo do candidato (US4) e o fluxo do
  recrutamento (US5) inteiramente por teclado.

---

## Riscos e dependências

- Textos visíveis usados como seletor nos testes Playwright: inventariar antes de renomear
  qualquer rótulo.
- `JobBuilder` concentra lógica de ordenação de etapas junto da marcação; a extração visual
  precisa preservar o comportamento de ordem — é o ponto de maior risco de regressão
  funcional da sprint.
- Não há arquivo de ambiente novo nesta sprint; nada aqui toca configuração.
