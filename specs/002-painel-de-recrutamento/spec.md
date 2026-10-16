# Feature Specification: Painel de Recrutamento e Triagem Automática (Sprint 2)

**Feature Branch**: `002-painel-de-recrutamento`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "Sprint 2 da CLTech (entrega 26/10/2026): o recrutador passa a
criar vagas e montar o pipeline de seleção (RF04); o sistema calcula automaticamente o
percentual de compatibilidade entre candidato e vaga (RN001, débito da FR-026 da Sprint 1);
o recrutador ganha um painel consolidado de todas as vagas (RF07) e consegue abrir o
relatório completo de um candidato dentro de uma candidatura para decidir avançar ou
reprovar (RF08); e consegue buscar candidatos já conhecidos entre todas as vagas (RF09)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver a compatibilidade com uma vaga antes de decidir (Priority: P1)

O candidato, ao navegar pelas vagas publicadas ou abrir os detalhes de uma, vê quanto o
próprio perfil (currículo + GitHub) combina com o que a vaga exige — sem precisar se
candidatar para descobrir se vale a pena.

**Why this priority**: fecha o débito deixado em aberto na Sprint 1 (FR-026: campo existia,
nunca era calculado) e é a peça que transforma a listagem de vagas de uma lista estática
num funil de fato direcionado. Sem ela, RF07 e RF08 não têm o que mostrar.

**Independent Test**: candidato com currículo e GitHub conectados abre a listagem de vagas
e vê um percentual em cada vaga publicada; o percentual muda depois de trocar o currículo
por um com tecnologias diferentes.

**Acceptance Scenarios**:

1. **Given** um candidato autenticado com currículo vigente, **When** ele abre a listagem de
   vagas publicadas, **Then** vê, em cada vaga, o percentual de compatibilidade do próprio
   perfil com aquela vaga.
2. **Given** um candidato autenticado sem currículo vigente, **When** ele abre a mesma
   listagem, **Then** vê uma orientação para completar o perfil em vez de um percentual.
3. **Given** um visitante não autenticado, **When** ele abre a listagem pública de vagas,
   **Then** não vê nenhum percentual de compatibilidade, para nenhuma vaga.
4. **Given** um candidato que troca o currículo vigente por outro com tecnologias
   diferentes, **When** ele volta a abrir a listagem de vagas, **Then** os percentuais
   exibidos refletem o novo currículo.
5. **Given** um candidato que abre o detalhe de uma vaga, **When** a página carrega,
   **Then** vê quais das tecnologias exigidas foram encontradas no seu perfil e quais não
   foram.

---

### User Story 2 - Montar o pipeline de seleção de uma vaga (Priority: P1)

O recrutador cria uma vaga nova e decide, para aquela vaga específica, quais etapas o
processo seletivo terá e em que ordem — análise de currículo, teste de código, análise de
GitHub, entrevista de RH, entrevista técnica, proposta final.

**Why this priority**: sem isso, as vagas continuam vindo só do seed; é o primeiro passo
real do recrutador na plataforma, origem de tudo que RF07/RF08/RF09 exibem.

**Independent Test**: recrutador cria uma vaga, monta um pipeline com três etapas em uma
ordem específica, publica, e confirma que a vaga aparece na listagem pública com aquele
pipeline.

**Acceptance Scenarios**:

1. **Given** um recrutador autenticado, **When** ele cria uma vaga preenchendo título,
   descrição, tecnologias exigidas e requisitos mínimos, **Then** a vaga é salva como
   rascunho, ainda não visível aos candidatos.
2. **Given** um recrutador editando o rascunho de uma vaga, **When** ele adiciona etapas do
   catálogo fixo e as ordena, **Then** a ordem é salva e refletida ao reabrir a tela.
3. **Given** uma vaga em rascunho sem tecnologias exigidas, sem requisitos mínimos ou sem
   nenhuma etapa configurada, **When** o recrutador tenta publicar, **Then** a publicação é
   bloqueada e os campos pendentes são destacados.
4. **Given** uma vaga em rascunho completa, **When** o recrutador publica, **Then** ela passa
   a aparecer na listagem pública de vagas com o pipeline configurado.
5. **Given** uma vaga já publicada, **When** o recrutador tenta alterar as tecnologias
   exigidas ou as etapas do pipeline, **Then** a plataforma recusa a alteração, informando
   que vagas publicadas têm o processo travado.

---

### User Story 3 - Ver o funil de contratação (Priority: P1)

O recrutador abre um painel único que mostra todas as vagas ativas, quantos candidatos estão
em cada etapa do processo e onde o funil está emperrando.

**Why this priority**: é como o RH deixa de perguntar "como estão os processos?" por e-mail
e passa a ter uma visão própria — o valor central do RF07.

**Independent Test**: com pelo menos duas vagas publicadas e candidatos em etapas
diferentes, o recrutador abre o painel e vê a contagem batendo com o que está no banco.

**Acceptance Scenarios**:

1. **Given** um recrutador autenticado com vagas publicadas, **When** ele abre o painel,
   **Then** vê cada vaga ativa com a contagem de candidatos por etapa do processo.
2. **Given** o recrutador no painel, **When** ele alterna de "todas as vagas" para uma vaga
   específica, **Then** os números exibidos passam a refletir só aquela vaga.
3. **Given** um recrutador sem nenhuma vaga publicada, **When** ele abre o painel, **Then**
   vê uma orientação para criar a primeira vaga em vez de uma tela vazia sem contexto.
4. **Given** candidaturas com histórico de mudança de etapa suficiente, **When** o
   recrutador abre o painel, **Then** vê o tempo médio de permanência por etapa e qual etapa
   concentra o maior tempo médio (o gargalo do funil).

---

### User Story 4 - Analisar um candidato a fundo e decidir (Priority: P1)

Dentro de uma vaga, o recrutador abre um candidato específico, vê o relatório completo —
score, justificativa, currículo, dados de GitHub — e decide se ele avança ou é reprovado.

**Why this priority**: é a decisão que efetivamente move alguém no funil; sem ela, RF07
mostra números mas ninguém consegue agir sobre eles.

**Independent Test**: recrutador abre um candidato com score calculado e currículo anexado,
confirma que todos os dados aparecem corretamente, registra uma decisão e confirma que o
candidato muda de etapa.

**Acceptance Scenarios**:

1. **Given** um recrutador dentro de uma vaga, **When** ele seleciona um candidato
   inscrito, **Then** vê dados básicos, score de compatibilidade com a justificativa
   (tecnologias encontradas vs. exigidas), contas externas conectadas e o currículo
   disponível para download.
2. **Given** um candidato sem GitHub conectado, **When** o recrutador abre o perfil dele,
   **Then** vê um aviso de que os dados de GitHub não estão disponíveis, sem o restante do
   relatório ficar bloqueado.
3. **Given** uma vaga cujo pipeline inclui a etapa de teste de código, **When** o candidato
   ainda não a completou, **Then** o recrutador vê "aguardando conclusão do teste" nessa
   seção — e "ainda não disponível nesta versão" quando a capacidade de corrigir o teste
   simplesmente não existe ainda (Sprint 3).
4. **Given** um recrutador no relatório de um candidato, **When** ele registra a decisão de
   avançar para a próxima etapa, **Then** a candidatura passa a refletir a nova etapa e o
   histórico registra a mudança.
5. **Given** o mesmo relatório, **When** o recrutador tenta de qualquer forma alterar o
   score exibido, **Then** não existe nenhum controle de edição disponível para isso.

---

### User Story 5 - Buscar e reaproveitar candidatos já conhecidos (Priority: P2)

O recrutador busca, entre todos os candidatos que já se inscreveram em qualquer vaga ao
longo do tempo, alguém por nome, e-mail ou tecnologia, e vê o histórico consolidado dessa
pessoa antes de decidir chamá-la para uma vaga nova.

**Why this priority**: resolve uma dor real (dados espalhados entre processos), mas não é
pré-requisito do fluxo principal desta sprint — classificado como "Desejável" no ERS. Pode
ser cortada sem quebrar as histórias 1-4 se o prazo apertar.

**Independent Test**: com um candidato que já se candidatou a duas vagas diferentes, o
recrutador busca pelo e-mail dele e vê as duas candidaturas agrupadas sob o mesmo perfil.

**Acceptance Scenarios**:

1. **Given** um recrutador autenticado, **When** ele busca por nome, e-mail ou tecnologia na
   aba "Candidatos", **Then** vê os candidatos correspondentes.
2. **Given** um candidato com candidaturas em vagas diferentes, **When** o recrutador abre o
   histórico dele, **Then** vê todas as candidaturas, com o score e a decisão tomada em cada
   uma.
3. **Given** uma busca sem nenhum resultado, **When** a lista é recalculada, **Then** a
   plataforma informa que não há candidatos correspondentes.

---

### Edge Cases

- **Candidato troca currículo depois de já ter se candidatado**: o score da candidatura já
  registrada (`Application`/`Evaluation`) não muda retroativamente — é uma fotografia do
  momento da inscrição. O percentual pré-calculado (`JobMatch`) para vagas às quais ele
  ainda não se candidatou, esse sim, é recalculado.
- **Vaga publicada sem nenhum candidato ainda**: aparece no painel com contagem zero em
  todas as etapas, não é tratada como erro.
- **Candidato com GitHub desconectado depois de ter se candidatado**: a avaliação de GitHub
  já registrada na candidatura permanece (é somente-leitura); só a compatibilidade futura
  deixa de considerar esse sinal.
- **Currículo em formato que o extrator de texto não consegue ler** (PDF escaneado como
  imagem, por exemplo): a extração falha, o currículo continua válido e anexado, e o score
  é calculado só com o sinal do GitHub quando disponível — nunca bloqueia a candidatura.
- **Duas etapas do mesmo tipo na mesma vaga**: o catálogo não impede repetição (ex.: duas
  entrevistas técnicas); a ordem define a sequência normalmente.
- **Recrutador tenta publicar vaga que já foi publicada antes**: operação inexistente —
  publicar é uma transição única de rascunho para publicada.
- **Busca de candidato (RF09) retornando alguém que nunca teve candidatura aprovada**: ainda
  assim aparece, com o histórico mostrando reprovações — a busca não filtra por resultado.

## Requirements *(mandatory)*

### Functional Requirements

**Triagem automática — origem: RN001, RN002, débito da FR-026 (Sprint 1)**

- **FR-032**: A plataforma MUST extrair o texto do currículo vigente de um candidato
  automaticamente ao recebê-lo, antes de qualquer exibição a recrutador, e MUST armazenar o
  texto extraído cifrado em repouso, no mesmo padrão do arquivo original.
- **FR-033**: A plataforma MUST calcular, para cada par candidato autenticado × vaga
  publicada, um percentual de compatibilidade (0 a 100) a partir da sobreposição entre as
  tecnologias exigidas pela vaga e o conjunto {texto do currículo, linguagens do GitHub do
  candidato}, acompanhado da lista de tecnologias encontradas e não encontradas.
- **FR-034**: A plataforma MUST recalcular o percentual de compatibilidade quando o
  currículo vigente do candidato mudar ou quando os dados de GitHub forem sincronizados, e
  MUST NOT calculá-lo durante o carregamento de uma listagem ou de uma página.
- **FR-035**: A plataforma MUST exibir o percentual de compatibilidade apenas ao próprio
  candidato autenticado dono do perfil — nunca a outro candidato nem a visitante não
  autenticado.
- **FR-036**: A plataforma MUST exibir uma orientação para completar o perfil, em vez de um
  percentual, quando o candidato autenticado não tiver currículo vigente — distinguindo
  esse caso de um score calculado igual a zero.
- **FR-037**: Ao registrar uma candidatura, a plataforma MUST gravar uma avaliação
  somente-leitura com o score de compatibilidade daquele momento e a justificativa
  (tecnologias encontradas vs. exigidas), sem disponibilizar nenhuma operação de edição
  sobre ela (RN003).

**Pipeline de seleção da vaga — origem: RF04, RN002**

- **FR-038**: A plataforma MUST permitir que um usuário com papel Recrutador ou
  Administrador crie uma vaga informando título, descrição, empresa, localização,
  modalidade, senioridade, tecnologias exigidas e requisitos mínimos, salva inicialmente
  como rascunho.
- **FR-039**: A plataforma MUST permitir montar o processo seletivo de uma vaga em rascunho
  escolhendo, entre os seis tipos de etapa predefinidos (análise de currículo, teste de
  código, análise de GitHub, entrevista de RH, entrevista técnica, proposta final), quais
  usar, podendo repetir tipos, e em que ordem.
- **FR-040**: A plataforma MUST impedir a publicação de uma vaga sem tecnologias exigidas,
  sem requisitos mínimos ou sem ao menos uma etapa configurada, indicando os campos
  pendentes.
- **FR-041**: Uma vez publicada, a plataforma MUST impedir alteração das tecnologias
  exigidas, dos requisitos mínimos e das etapas do processo seletivo daquela vaga.
- **FR-042**: A plataforma MUST permitir reordenar as etapas de uma vaga em rascunho antes
  da publicação.

**Painel de recrutamento — origem: RF07**

- **FR-043**: A plataforma MUST exibir a um recrutador autenticado uma visão consolidada de
  todas as vagas, com a contagem de candidatos em cada etapa do processo seletivo de cada
  uma.
- **FR-044**: A plataforma MUST permitir alternar a visão do painel entre todas as vagas e
  uma vaga específica.
- **FR-045**: A plataforma MUST calcular e exibir, a partir do histórico de mudança de
  etapa, o tempo médio de permanência por etapa, a taxa de avanço por etapa e qual etapa
  concentra o maior tempo médio de permanência — nunca como texto gerado livremente.
- **FR-046**: A plataforma MUST exibir uma orientação para criar a primeira vaga quando o
  recrutador não tiver nenhuma vaga publicada.

**Análise detalhada do candidato — origem: RF08, RN003, RN004**

- **FR-047**: A plataforma MUST permitir que um recrutador abra, a partir do painel ou de
  uma vaga, o relatório de um candidato dentro de uma candidatura específica, exibindo
  dados básicos, score de compatibilidade com a justificativa, contas externas conectadas,
  o currículo disponível para download e o resultado do teste de código quando aplicável.
- **FR-048**: A plataforma MUST exibir "ainda não disponível nesta versão" para o resultado
  do teste de código enquanto essa capacidade não existir, sem bloquear a exibição do
  restante do relatório.
- **FR-049**: A plataforma MUST permitir que o recrutador registre a decisão de avançar ou
  reprovar o candidato para a etapa seguinte configurada, gravando a mudança no histórico da
  candidatura com data e autor.
- **FR-050**: A plataforma MUST NOT expor, em nenhuma interface, operação de alteração do
  score de compatibilidade calculado — apenas a decisão de avançar/reprovar é editável.

**Busca e histórico de candidatos — origem: RF09, RN007**

- **FR-051**: A plataforma MUST permitir que um recrutador busque, entre todos os
  candidatos já inscritos em qualquer vaga, por nome, e-mail ou tecnologia.
- **FR-052**: A plataforma MUST agrupar os resultados por candidato único (por e-mail),
  exibindo todas as candidaturas anteriores daquele candidato, os scores obtidos em cada
  uma e a decisão tomada.
- **FR-053**: A plataforma MUST informar explicitamente quando nenhum candidato corresponder
  aos termos buscados.

**Qualidade de acesso — origem: RNF04 (continuação da Sprint 1)**

- **FR-054**: Todas as telas novas desta sprint (construtor de vaga, painel, relatório do
  candidato, busca de candidatos) MUST ser utilizáveis de 360 px a 1280 px de largura, sem
  perda de função.

### Key Entities

- **Vaga** (já existente): ganha nesta sprint o fluxo real de criação e publicação pelo
  recrutador, com a trava de edição pós-publicação (FR-041).
- **Etapa do Processo** (já existente): passa a ser escolhida e ordenada pelo recrutador no
  momento da criação da vaga, em vez de vir só do seed.
- **Compatibilidade Pré-calculada** (`JobMatch`, já modelada na Sprint 1): passa a ser
  efetivamente calculada e exibida — par candidato × vaga publicada, com score e lista de
  tecnologias encontradas/faltantes, recalculada quando currículo ou GitHub do candidato
  mudam.
- **Avaliação** (`Evaluation`, já modelada na Sprint 1): passa a ser gerada no momento da
  candidatura — registro somente-leitura e versionado com o score e a justificativa daquele
  instante, por candidatura.
- **Histórico de Etapa** (`ApplicationStageHistory`, já existente): passa a alimentar as
  métricas do painel (tempo médio por etapa, gargalo) além de registrar a decisão do
  recrutador.
- **Currículo** (já existente): ganha o texto extraído automaticamente, cifrado, usado como
  insumo do cálculo de compatibilidade.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-010**: Um recrutador consegue criar uma vaga completa, montar o pipeline e publicá-la
  em menos de 5 minutos, sem ajuda externa.
- **SC-011**: 100% das vagas publicadas têm, no momento da publicação, ao menos uma etapa e
  as tecnologias exigidas definidas — nenhuma publicação incompleta é possível.
- **SC-012**: Todo candidato autenticado com currículo vigente vê um percentual de
  compatibilidade em 100% das vagas publicadas que visualiza.
- **SC-013**: O painel de recrutamento e a listagem de vagas com compatibilidade
  permanecem utilizáveis em até 3 segundos com 50 pessoas usando a plataforma ao mesmo
  tempo (RNF03).
- **SC-014**: Nenhum score de compatibilidade é alterado por nenhuma via, em 100% das
  tentativas, inclusive acesso direto ao banco (RN003, trigger já existente desde a
  Sprint 1).
- **SC-015**: Um recrutador localiza, pela busca (RF09), um candidato que já se candidatou
  a uma vaga diferente da atual, vendo as duas candidaturas agrupadas sob o mesmo perfil.

## Assumptions

- **O motor de triagem roda inline no backend (TypeScript), não como serviço Python
  separado** — divergência deliberada do que `services/ai/README.md` previa desde a
  Sprint 1, documentada em [D11](../001-portal-candidatura/ers-divergences.md#d11).
- **O algoritmo de compatibilidade é determinístico, não usa LLM** — sobreposição de
  tecnologias exigidas vs. {texto do currículo, linguagens do GitHub}, pelos mesmos motivos
  do [D11](../001-portal-candidatura/ers-divergences.md#d11): RN003 exige score
  reproduzível e os Princípios I/II exigem que dado de candidato não saia da
  infraestrutura.
- **"Insights automáticos" do painel (RF07) são métricas calculadas, não texto gerado por
  IA** — decisão já registrada em
  [D4](../001-portal-candidatura/ers-divergences.md#d4), que segue pendente de aval do
  professor antes da entrega desta sprint.
- **O construtor de pipeline usa reordenação por botões (subir/descer), não
  arrastar-e-soltar** — mesma função do RF04, sem adicionar biblioteca de drag-and-drop ao
  orçamento de 10 dias da sprint. Pode ser trocado depois sem mudar contrato ou schema.
- **Vaga publicada tem pipeline e tecnologias travados** — corte explícito do RF04-A2 do
  ERS (que pede reprocessar o score dos inscritos ao editar vaga publicada). Documentado
  como [D7](../001-portal-candidatura/ers-divergences.md#d7) desde a Sprint 1: reprocessar
  é tecnicamente compatível com a RN003, mas fica fora do corte desta sprint por prazo —
  editar pipeline published pode entrar como melhoria futura.
- **RF09 "convidar candidato para nova vaga" não envia e-mail de verdade** — não há
  provedor de e-mail transacional ligado ainda (isso é RN005, Sprint 3, [D6](../001-portal-candidatura/ers-divergences.md#d6)).
  Nesta sprint, "convidar" é um link manual para o recrutador apontar a vaga ao candidato
  por fora da plataforma.
- **O teste de código (RF05/RF06) não existe nesta sprint.** A etapa `CODE_TEST` pode ser
  configurada no pipeline (FR-039) e aparece no relatório do candidato (FR-048) como "ainda
  não disponível" — é Sprint 3.
- **A leitura do currículo é extração de texto e checagem de palavras-chave, não
  compreensão de linguagem natural.** Currículos ilegíveis para o extrator (ex.: PDF
  escaneado como imagem) não bloqueiam a candidatura; o score usa só o sinal disponível
  (GitHub, se houver).

## Divergências em relação ao ERS

Esta sprint introduz uma divergência nova — [D11](../001-portal-candidatura/ers-divergences.md#d11)
(motor de triagem inline, não em serviço Python separado) — e resolve a decisão que havia
ficado pendente em [D3](../001-portal-candidatura/ers-divergences.md#d3) desde a Sprint 1.
As demais divergências relevantes a este escopo (D4, D6, D7) já estavam registradas e
continuam válidas como estão; nenhuma delas é alterada por esta sprint.
