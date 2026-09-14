# Feature Specification: Portal de Candidatura (Sprint 1)

**Feature Branch**: `001-portal-candidatura`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "Sprint 1 da CLTech (entrega 14/09/2026): fundação web do portal de recrutamento. Escopo: [RF01] Autenticação e Cadastro; [RF02] Gestão de Perfil do Candidato; [RF03] Busca e Candidatura a Vagas; e o modelo de dados relacional completo que suportará também as Sprints 2 e 3."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar na plataforma (Priority: P1)

Uma pessoa interessada nas vagas da 3aq chega ao site, cria uma conta com e-mail e
senha (ou usando a conta que já tem no GitHub ou no LinkedIn) e passa a ter uma
identidade própria dentro da plataforma. Quem entra é levado direto para o lugar
certo: candidato vai para as vagas disponíveis, recrutador vai para a área de
recrutamento.

**Why this priority**: é o portão de entrada de todo o resto. Sem identidade não há
perfil, não há candidatura e não há como amarrar o histórico de uma pessoa às suas
inscrições. Nenhuma outra história desta sprint funciona sem esta.

**Independent Test**: pode ser testada isoladamente criando uma conta nova, saindo,
entrando de novo e confirmando que a sessão persiste e que o destino após o login
corresponde ao papel da conta. Entrega valor sozinha: a 3aq já passa a ter uma base
de pessoas cadastradas em vez de e-mails soltos.

**Acceptance Scenarios**:

1. **Given** um visitante sem conta, **When** ele preenche nome, e-mail e senha
   válidos e confirma o cadastro, **Then** a conta é criada com o papel Candidato e
   ele passa a estar autenticado.
2. **Given** um candidato já cadastrado, **When** ele informa e-mail e senha
   corretos, **Then** ele é autenticado e levado à lista de vagas disponíveis.
3. **Given** um recrutador já cadastrado, **When** ele se autentica com sucesso,
   **Then** ele é levado à área de recrutamento e não à lista pública de vagas.
4. **Given** um visitante na tela de login, **When** ele informa e-mail ou senha
   incorretos, **Then** o acesso é negado com mensagem de erro e nenhuma sessão é
   criada.
5. **Given** um visitante que escolhe entrar pela conta externa (GitHub ou LinkedIn),
   **When** ele autoriza o acesso no provedor, **Then** a plataforma cria a conta ou
   a associa a uma conta já existente com o mesmo e-mail, sem gerar perfil duplicado.
6. **Given** um usuário autenticado, **When** ele fecha e reabre o navegador dentro
   do prazo de validade da sessão, **Then** ele continua autenticado.

---

### User Story 2 - Montar o próprio perfil (Priority: P1)

O candidato preenche seus dados básicos, conecta suas contas externas (GitHub,
LinkedIn, Lattes) e anexa o currículo. É esse conjunto de informações que, nas
próximas sprints, vai alimentar a análise automática — mas já nesta sprint ele
substitui a coleta manual por e-mail.

**Why this priority**: é o dado que dá sentido a toda a plataforma. Sem currículo e
sem GitHub conectado não existe matéria-prima para a triagem automática da Sprint 2.

**Independent Test**: pode ser testada isoladamente preenchendo o perfil, anexando um
currículo, conectando o GitHub e recarregando a página para confirmar que tudo
persistiu. Entrega valor sozinha: centraliza num só lugar o que hoje está espalhado
em e-mails e pastas.

**Acceptance Scenarios**:

1. **Given** um candidato autenticado sem perfil preenchido, **When** ele abre "Meu
   Perfil", **Then** vê os campos de nome, e-mail, telefone e cidade/estado, já
   preenchidos com o que a plataforma conhece.
2. **Given** um candidato editando o perfil, **When** ele altera os dados e salva,
   **Then** as alterações são persistidas e visíveis ao recarregar a página.
3. **Given** um candidato no perfil, **When** ele anexa um currículo em PDF ou DOCX
   de até 5 MB, **Then** o arquivo é aceito, associado ao perfil e pode ser
   substituído depois.
4. **Given** um candidato no perfil, **When** ele anexa um arquivo de formato
   diferente ou acima de 5 MB, **Then** o envio é recusado com mensagem explicando o
   motivo e o currículo anterior permanece intacto.
5. **Given** um candidato que conecta a conta do GitHub, **When** a conexão é
   autorizada, **Then** a plataforma passa a exibir no perfil as linguagens, os
   repositórios públicos e a frequência de atividade coletados.
6. **Given** um candidato cujo GitHub é privado ou inexistente, **When** a coleta é
   tentada, **Then** a plataforma marca os dados de GitHub como "Indisponível",
   registra o motivo e permite que ele siga usando a plataforma normalmente.
7. **Given** um candidato com uma conta externa já conectada, **When** ele escolhe
   desconectá-la, **Then** o vínculo é removido e os dados coletados daquela origem
   deixam de ser exibidos.

---

### User Story 3 - Encontrar uma vaga e se candidatar (Priority: P1)

O candidato navega pelas vagas publicadas, filtra pelo que lhe interessa, abre os
detalhes de uma delas e se inscreve. A partir da inscrição, ele passa a acompanhar em
que etapa do processo está.

**Why this priority**: é o gatilho do fluxo principal da demanda. As histórias 1 e 2
existem para viabilizar esta. As três juntas formam o fluxo demonstrável da Sprint 1.

**Independent Test**: pode ser testada isoladamente com vagas pré-cadastradas: buscar,
filtrar, abrir detalhes, confirmar a inscrição e verificar que ela aparece com status
inicial. Entrega valor sozinha: elimina a candidatura por e-mail.

**Acceptance Scenarios**:

1. **Given** um visitante não autenticado, **When** ele acessa a listagem de vagas,
   **Then** vê as vagas publicadas com título, empresa, localização, modalidade e
   tecnologias exigidas.
2. **Given** um candidato na listagem, **When** ele aplica filtros (por exemplo
   modalidade remota e senioridade), **Then** a lista passa a mostrar apenas as vagas
   correspondentes.
3. **Given** um candidato que aplicou filtros sem resultado, **When** a lista é
   recalculada, **Then** a plataforma informa que nenhuma vaga corresponde e sugere
   ampliar a busca.
4. **Given** um candidato autenticado com perfil preenchido, **When** ele abre os
   detalhes de uma vaga e confirma a candidatura, **Then** a inscrição é registrada
   com o status da primeira etapa do processo daquela vaga.
5. **Given** um candidato já inscrito em uma vaga, **When** ele tenta se candidatar de
   novo à mesma vaga, **Then** a plataforma recusa a nova inscrição e mostra o status
   atual do processo dele.
6. **Given** um visitante não autenticado, **When** ele tenta se candidatar,
   **Then** é levado a entrar ou criar conta e, ao concluir, retorna à vaga que estava
   vendo.
7. **Given** um candidato sem currículo anexado, **When** ele tenta se candidatar,
   **Then** a plataforma o orienta a completar o perfil antes de concluir a inscrição.

---

### User Story 4 - Acompanhar as próprias candidaturas (Priority: P2)

O candidato consulta, em um só lugar, todas as vagas às quais se inscreveu e em que
etapa está cada processo.

**Why this priority**: não é pré-requisito do fluxo principal, mas é o que evita que o
candidato mande e-mail perguntando "e aí?" — parte do problema de dispersão que a
demanda cita. Pode ser cortada se o prazo apertar, sem quebrar as histórias P1.

**Independent Test**: pode ser testada isoladamente por um candidato com duas ou mais
inscrições, conferindo se todas aparecem com o status correto.

**Acceptance Scenarios**:

1. **Given** um candidato com inscrições ativas, **When** ele abre "Minhas
   Candidaturas", **Then** vê cada vaga, a data da inscrição e a etapa atual.
2. **Given** um candidato sem nenhuma inscrição, **When** ele abre a mesma tela,
   **Then** vê uma orientação para explorar as vagas disponíveis.

---

### Edge Cases

- **Duas contas para a mesma pessoa**: alguém cadastra e-mail/senha e depois entra pelo
  GitHub com o mesmo e-mail. A plataforma associa ao perfil existente em vez de criar
  um segundo — a identidade é o e-mail.
- **Provedor externo fora do ar**: se GitHub ou LinkedIn não responderem durante o
  login, a plataforma informa a falha e mantém disponível a entrada por e-mail/senha.
- **Coleta de GitHub falha depois de conectada**: o vínculo permanece, os dados ficam
  marcados como "Indisponível" e a coleta pode ser tentada novamente.
- **Vaga despublicada com candidatos inscritos**: quem já se inscreveu continua vendo a
  própria inscrição e seu status; a vaga deixa de aparecer para novos candidatos.
- **Currículo corrompido ou ilegível**: o arquivo é aceito se respeitar formato e
  tamanho, mas fica sinalizado para a etapa de leitura automática da Sprint 2, sem
  travar a candidatura.
- **Envio simultâneo da mesma candidatura** (duplo clique, duas abas): apenas uma
  inscrição é registrada.
- **Senha fraca ou e-mail já cadastrado**: o cadastro é recusado com mensagem
  específica, sem revelar se o e-mail pertence a uma conta existente de forma que
  permita enumerar usuários.
- **Sessão expirada durante o preenchimento do perfil**: o candidato é levado a
  autenticar novamente e retorna à tela em que estava.

## Requirements *(mandatory)*

### Functional Requirements

**Identidade e acesso — origem: RF01, RN007**

- **FR-001**: A plataforma MUST permitir que um visitante crie uma conta informando
  nome, e-mail e senha, atribuindo a ela o papel Candidato por padrão.
- **FR-002**: A plataforma MUST permitir que um visitante crie conta ou se autentique
  usando GitHub ou LinkedIn como provedor de identidade.
- **FR-003**: A plataforma MUST associar um acesso via provedor externo a uma conta
  existente quando o e-mail coincidir, mantendo um único perfil por e-mail.
- **FR-004**: A plataforma MUST negar acesso e informar erro quando as credenciais
  forem inválidas, sem criar sessão e sem revelar se o e-mail existe.
- **FR-005**: A plataforma MUST manter a sessão autenticada entre visitas e MUST
  permitir encerrá-la explicitamente.
- **FR-006**: A plataforma MUST direcionar o usuário após a autenticação conforme seu
  papel: Candidato para as vagas disponíveis, Recrutador ou Administrador para a área
  de recrutamento.
- **FR-007**: A plataforma MUST armazenar senhas apenas em forma irreversível, nunca
  recuperável em texto claro.
- **FR-008**: A plataforma MUST restringir toda área de recrutamento a contas com papel
  Recrutador ou Administrador, verificando a permissão no servidor a cada acesso.

**Perfil do candidato — origem: RF02, RNF05, RN004**

- **FR-009**: Um candidato autenticado MUST poder visualizar e editar nome, e-mail,
  telefone e cidade/estado do seu perfil.
- **FR-010**: A plataforma MUST permitir conectar e desconectar as contas de GitHub,
  LinkedIn e Lattes ao perfil do candidato.
- **FR-011**: A plataforma MUST, ao conectar o GitHub, coletar automaticamente
  linguagens utilizadas, repositórios públicos e frequência de atividade do candidato.
- **FR-012**: A plataforma MUST marcar os dados de uma origem externa como
  "Indisponível", registrando o motivo, quando a coleta falhar ou o perfil for privado,
  e MUST NOT impedir o candidato de prosseguir.
- **FR-013**: A plataforma MUST permitir nova tentativa de coleta de uma origem externa
  marcada como indisponível.
- **FR-014**: A plataforma MUST aceitar upload de currículo nos formatos PDF e DOCX com
  até 5 MB, e MUST recusar arquivos fora desses limites com mensagem explicativa.
- **FR-015**: A plataforma MUST permitir substituir o currículo anexado, preservando o
  registro de qual arquivo estava vigente em cada candidatura.
- **FR-016**: A plataforma MUST armazenar dados pessoais e o arquivo de currículo
  cifrados em repouso e trafegá-los apenas por canal cifrado.
- **FR-017**: A plataforma MUST restringir o acesso ao currículo original e aos dados
  coletados de origens externas ao próprio candidato e a contas com papel Recrutador ou
  Administrador.

**Vagas e candidatura — origem: RF03, RF04 (parcial), RN007**

- **FR-018**: A plataforma MUST exibir publicamente a lista de vagas publicadas com
  título, empresa, localização, modalidade e tecnologias exigidas.
- **FR-019**: A plataforma MUST permitir filtrar as vagas por modalidade, senioridade e
  tecnologia, e MUST informar explicitamente quando nenhum resultado corresponder.
- **FR-020**: A plataforma MUST exibir a página de detalhes de uma vaga com descrição,
  requisitos e etapas do processo seletivo configurado para ela.
- **FR-021**: Um candidato autenticado MUST poder se candidatar a uma vaga publicada, e
  a inscrição MUST ser registrada com a etapa inicial do processo daquela vaga.
- **FR-022**: A plataforma MUST impedir que um mesmo candidato tenha mais de uma
  inscrição ativa na mesma vaga, exibindo o status atual em vez de criar outra.
- **FR-023**: A plataforma MUST conduzir um visitante não autenticado à autenticação ao
  tentar se candidatar e MUST retorná-lo à vaga de origem ao concluir.
- **FR-024**: A plataforma MUST exigir currículo anexado antes de concluir uma
  candidatura.
- **FR-025**: Um candidato MUST poder consultar todas as suas candidaturas com a vaga,
  a data da inscrição e a etapa atual de cada uma.
- **FR-026**: A plataforma MUST registrar para cada candidatura um campo de
  compatibilidade com a vaga, mantido vazio e assinalado como "não calculado" nesta
  sprint.

**Estrutura de dados — origem: escopo da sprint, RN001, RN003, RN006**

- **FR-027**: O modelo de dados MUST comportar, desde já, as entidades e estados
  necessários às sprints seguintes — processo seletivo em etapas ordenadas, resultado de
  triagem, submissão de teste técnico e relatório de desempenho — ainda que sem
  comportamento implementado nesta sprint.
- **FR-028**: O modelo de dados MUST tratar score de compatibilidade e score técnico
  como registros somente-leitura e versionados, sem operação de edição disponível.
- **FR-029**: A plataforma MUST registrar data e hora de criação e de última alteração
  de cada candidatura e de cada mudança de etapa.

**Qualidade de acesso — origem: RNF04**

- **FR-030**: Todas as telas desta sprint MUST ser utilizáveis em telas a partir de
  360 px de largura e em telas de 1280 px ou mais, sem perda de função.
- **FR-031**: Todo o fluxo do candidato MUST ser completável apenas com um navegador,
  sem instalação de software local.

### Key Entities

- **Usuário**: identidade de acesso à plataforma. Identificado unicamente pelo e-mail.
  Possui exatamente um papel: Candidato, Recrutador ou Administrador. Guarda o meio de
  autenticação (senha própria e/ou provedores externos vinculados).
- **Candidato**: dados pessoais e profissionais de quem se inscreve — nome, contato,
  localidade. Relaciona-se com um único Usuário e concentra o histórico de todas as
  suas candidaturas ao longo do tempo.
- **Conta Externa**: vínculo entre um candidato e uma origem externa (GitHub, LinkedIn,
  Lattes), com estado da coleta — conectada, indisponível ou desconectada — e a data da
  última sincronização.
- **Perfil de GitHub**: fotografia dos dados coletados do GitHub de um candidato —
  linguagens, repositórios públicos, frequência de atividade — com a data em que foram
  obtidos.
- **Currículo**: arquivo enviado pelo candidato, com formato, tamanho, data de envio e
  indicação de qual versão estava vigente em cada candidatura.
- **Vaga**: posição aberta pela 3aq, com título, descrição, localização, modalidade,
  senioridade, tecnologias exigidas, requisitos mínimos e situação (rascunho, publicada,
  encerrada).
- **Etapa do Processo**: passo ordenado do processo seletivo de uma vaga (análise de
  currículo, teste de código, análise de GitHub, entrevista de RH, entrevista técnica,
  proposta final), com seus parâmetros de configuração.
- **Candidatura**: inscrição de um candidato em uma vaga. Única por par
  candidato + vaga. Guarda a etapa atual, o histórico de mudanças de etapa, a data de
  inscrição e o campo de compatibilidade ainda não calculado.
- **Avaliação**: resultado somente-leitura produzido automaticamente para uma
  candidatura, com pontuação, justificativa e data. Modelada nesta sprint, preenchida
  nas seguintes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um candidato novo consegue criar conta, completar o perfil com currículo
  e se candidatar a uma vaga em menos de 8 minutos, sem ajuda externa.
- **SC-002**: 95% dos candidatos que iniciam o cadastro concluem a primeira candidatura
  na mesma sessão, em teste com pelo menos 10 pessoas.
- **SC-003**: Nenhum candidato consegue registrar duas inscrições na mesma vaga, em
  100% das tentativas, inclusive com envios simultâneos.
- **SC-004**: Dois cadastros feitos com o mesmo e-mail por caminhos diferentes
  (formulário e provedor externo) resultam sempre em um único perfil.
- **SC-005**: A listagem de vagas e a tela de perfil ficam utilizáveis em até 3 segundos
  com 50 pessoas usando a plataforma ao mesmo tempo.
- **SC-006**: Todo o fluxo do candidato é concluído com sucesso em tela de 360 px e em
  tela de 1280 px, sem rolagem horizontal e sem elemento inacessível.
- **SC-007**: Uma pessoa sem permissão de recrutador não consegue, em nenhuma tentativa,
  visualizar currículo ou dados de GitHub de outro candidato.
- **SC-008**: Falha do GitHub durante a coleta nunca interrompe a candidatura: em 100%
  dos casos simulados o candidato conclui a inscrição com os dados marcados como
  "Indisponível".
- **SC-009**: Ao fim da sprint, 100% das candidaturas da 3aq entram por esta plataforma
  em vez de por e-mail, em ambiente de demonstração.

## Assumptions

- **Vagas são cadastradas fora do fluxo desta sprint**. A criação de vagas pelo
  recrutador (RF04) pertence à Sprint 2; para demonstrar as histórias P1, as vagas e
  suas etapas são pré-carregadas na base. O modelo já comporta o construtor de
  pipeline.
- **O percentual de match não é calculado nesta sprint**. O campo existe e é exibido
  como "em processamento" ou omitido, porque o motor de IA é escopo da Sprint 2.
- **O painel do recrutador não faz parte desta entrega**. Contas com papel Recrutador
  autenticam e são direcionadas para a área de recrutamento, que nesta sprint pode ser
  uma tela mínima. O painel completo (RF07/RF08) é da Sprint 2.
- **O feedback automático por e-mail (RN005) fica para a Sprint 3**, junto com a
  auditoria de criptografia, conforme o cronograma do ERS.
- **A leitura do conteúdo do currículo não ocorre nesta sprint** — o arquivo é apenas
  recebido, validado e guardado com segurança.
- **Um usuário tem um único papel**. Não há, nesta versão, alguém que seja candidato e
  recrutador ao mesmo tempo.
- **O idioma da interface é o português do Brasil**, sem internacionalização.
- **Os provedores externos exigem cadastro de aplicação** junto ao GitHub e ao
  LinkedIn; a indisponibilidade desse cadastro no prazo derruba apenas a FR-002, sem
  afetar o cadastro por e-mail e senha.
- **O acesso do candidato aos seus próprios dados** (retificação e exclusão previstas na
  LGPD) é coberto pela edição de perfil nesta sprint; o fluxo formal de exclusão de
  conta fica para uma sprint posterior.
- **A listagem e o detalhe de vaga são públicos**, acessíveis sem conta. A autenticação é
  exigida apenas no ato de se candidatar (FR-023). O ERS descreve o RF03 com pré-condição
  de candidato autenticado; a divergência é deliberada e está registrada em
  [D8](./ers-divergences.md#d8) — exigir cadastro para *ver* vagas contraria a missão
  declarada na seção 1.2.3 do próprio ERS.
- **Nome e e-mail não são cifrados em coluna.** O RNF05 pede criptografia em repouso para
  ambos, mas isso é tecnicamente incompatível com a RN007 (índice único por e-mail) e com o
  RF09 (busca por nome). Resolução em [D1](./ers-divergences.md#d1); ambos ficam protegidos
  por controle de acesso e criptografia de disco.
- **Só o GitHub tem coleta automática de dados.** O LinkedIn serve como provedor de
  autenticação e link de perfil, e o Lattes é link manual — nenhum dos dois expõe API que
  devolva experiência, competências ou formação. Ver [D9](./ers-divergences.md#d9).

## Divergências em relação ao ERS

As nove diferenças entre esta especificação e o `CLTech - ERS.docx` v1.0 estão registradas,
justificadas e com prazo de ação em [ers-divergences.md](./ers-divergences.md), conforme
exige a seção *Fluxo de Desenvolvimento* da constituição.

Duas afetam a Sprint 1 — [D1](./ers-divergences.md#d1) (cifra de nome e e-mail) e
[D8](./ers-divergences.md#d8) (listagem pública). As demais são de Sprint 2 e 3.
