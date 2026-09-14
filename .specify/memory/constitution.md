<!--
SYNC IMPACT REPORT (scratch — remover antes do commit da emenda)
Versão: TEMPLATE (não ratificada) -> 1.0.0
Motivo do bump: ratificação inicial. Todos os placeholders do scaffold foram
substituídos por conteúdo concreto derivado do ERS CLTech v1.0 (24/08/2026) e da
demanda da 3aq Tecnologia.

Princípios definidos (6 — o scaffold previa 5; o domínio exige o sexto):
  [PRINCIPLE_1] -> I. Privacidade e LGPD por Padrão (NÃO-NEGOCIÁVEL)
  [PRINCIPLE_2] -> II. Score Objetivo e Imutável (NÃO-NEGOCIÁVEL)
  [PRINCIPLE_3] -> III. Triagem Sempre Mediada por IA
  [PRINCIPLE_4] -> IV. Isolamento Total na Execução de Código de Terceiros (NÃO-NEGOCIÁVEL)
  [PRINCIPLE_5] -> V. Acesso Exclusivo via Navegador
  (novo)        -> VI. Simplicidade Orçamentária e Manutenibilidade

Seções adicionadas:
  [SECTION_2_NAME] -> Restrições Técnicas e de Stack
  [SECTION_3_NAME] -> Fluxo de Desenvolvimento e Portões de Qualidade

Seções removidas: nenhuma.

Follow-up TODOs: nenhum. RATIFICATION_DATE definida como 2026-09-12 (data de
adoção pela equipe); o ERS que a fundamenta é de 2026-08-24.
-->

# CLTech Constitution

A CLTech é a Plataforma de Seleção Automatizada e Inteligente de Talentos da 3aq
Tecnologia. Esta constituição governa as decisões técnicas do produto e prevalece
sobre preferências individuais da equipe.

## Core Principles

### I. Privacidade e LGPD por Padrão (NÃO-NEGOCIÁVEL)

Todo dado pessoal de candidato — nome, e-mail, telefone, localidade, arquivo de
currículo, links de LinkedIn/GitHub/Lattes e resultados de avaliação — MUST ser
armazenado com criptografia em repouso (AES-256) e trafegado exclusivamente via
HTTPS. Relatórios detalhados, currículo original e dados de GitHub MUST ser
legíveis apenas por usuários autenticados com papel RECRUITER ou ADMIN; todo
endpoint que exponha esses dados MUST verificar o papel no servidor, nunca apenas
na interface. Nenhum dado pessoal pode ser enviado a serviço de terceiros
(incluindo provedores de LLM) sem finalidade declarada e sem minimização prévia do
payload. Logs MUST NOT conter dado pessoal em texto claro.

Racional: a conformidade com a LGPD é restrição explícita e inegociável da demanda
(RNF05, RN004); uma violação aqui invalida o produto inteiro, não apenas uma
funcionalidade.

### II. Score Objetivo e Imutável (NÃO-NEGOCIÁVEL)

O score de compatibilidade e o score técnico gerados pelos motores de IA MUST ser
persistidos como somente-leitura. MUST NOT existir rota, mutação, tela ou operação
administrativa capaz de editar um score já emitido. A correção de um score errado
se dá exclusivamente por reprocessamento, que MUST gravar um novo registro
versionado preservando o anterior. A decisão humana (avançar ou reprovar) é
registrada como campo separado e nunca sobrescreve o score. Candidatos de uma mesma
vaga MUST ser pontuados pelo mesmo conjunto de critérios e casos de teste.

Racional: a demanda existe porque avaliações manuais eram subjetivas e desiguais
(RN003). Um score editável reintroduz exatamente o problema que a plataforma foi
criada para eliminar.

### III. Triagem Sempre Mediada por IA

Nenhum currículo submetido chega ao painel do recrutador sem passar antes pelo motor
de triagem. A consulta de candidatos pelo RH MUST partir sempre de dados já
processados; a plataforma MUST NOT expor listagem "bruta" de inscrições não
analisadas. Enquanto o processamento não terminou, a interface MUST exibir estado
explícito de "em processamento" em vez de apresentar dados parciais como finais.
Toda pontuação MUST vir acompanhada de justificativa rastreável (competências
encontradas x exigidas).

Racional: RN001 e RN002. Garante padronização e evita que o viés manual volte pela
porta dos fundos.

### IV. Isolamento Total na Execução de Código de Terceiros (NÃO-NEGOCIÁVEL)

Código submetido por candidato MUST executar em sandbox isolado, sem acesso à rede,
sem acesso ao sistema de arquivos do host e com limites rígidos de CPU, memória e
tempo (máximo de 10 segundos por submissão). O sandbox MUST ser descartado após cada
execução. Código de candidato MUST NOT executar no mesmo processo, container ou
credencial da aplicação. Violação de limite ou tentativa de escapar do sandbox MUST
reprovar a submissão por segurança e ser registrada em auditoria.

Racional: RNF06. Executar código arbitrário de desconhecidos é a maior superfície de
ataque do produto e a única capaz de comprometer o host inteiro.

### V. Acesso Exclusivo via Navegador

Candidatos MUST conseguir percorrer todo o processo — cadastro, perfil, candidatura,
teste técnico e feedback — usando apenas um navegador, sem instalar nada localmente.
Isso inclui o editor de código do teste técnico, que MUST ser embutido na aplicação
web. A interface MUST ser responsiva de 360px a 1280px+ e seguir WCAG nível A como
mínimo.

Racional: restrição explícita da demanda (arquitetura web) e RNF04. Exigir instalação
local elimina candidatos e quebra o propósito de reduzir atrito.

### VI. Simplicidade Orçamentária e Manutenibilidade

Toda decisão de arquitetura MUST caber no limite orçamental do protótipo e ser
mantível por uma equipe pequena. Preferir uma peça a duas: um serviço novo, um banco
novo ou uma dependência paga só entram quando um princípio acima os exigir e a
alternativa simples tiver sido descartada por escrito. Custo recorrente de terceiros
(LLM, sandbox, e-mail) MUST ser estimado antes da adoção e ter limite configurável. O
código MUST usar a stack acordada, com tipos explícitos nas fronteiras entre camadas.

Racional: o orçamento do protótipo é limitado (~R$ 2.070 estimados, teto de R$
10.000) e a 3aq assume a manutenção futura. Complexidade não justificada é dívida que
outra equipe vai pagar.

## Restrições Técnicas e de Stack

- **Aplicação principal**: Next.js (React no cliente, rotas de API em Node) — atende à
  exigência de React + Node da demanda em um único deploy.
- **Serviço de IA**: Python com FastAPI, isolado da aplicação principal, responsável
  pela leitura de currículo, cálculo de compatibilidade e correção de submissões.
- **Persistência**: banco relacional. Candidato é identificado unicamente por e-mail
  (RN007); um mesmo e-mail MUST NOT gerar perfis duplicados.
- **Integração obrigatória**: API do GitHub para análise de portfólio. Falha ou perfil
  privado MUST degradar para "Indisponível" sem bloquear a candidatura.
- **Processamento pesado assíncrono**: triagem e correção de código MUST rodar fora do
  ciclo request/response, com estado observável pelo usuário. O relatório de desempenho
  MUST ficar pronto em até 5 minutos após a submissão (RNF03).
- **Desempenho de consulta**: listagem de vagas e painel de recrutamento MUST responder
  em até 3 segundos com até 50 usuários simultâneos.
- **Segredos**: chaves de API e credenciais MUST vir de variáveis de ambiente e MUST
  NOT ser versionadas.

## Fluxo de Desenvolvimento e Portões de Qualidade

- O ERS (`CLTech - ERS.docx`) é a fonte de verdade dos requisitos. Divergência entre
  código e ERS MUST ser resolvida atualizando um dos dois explicitamente, nunca no
  silêncio.
- Toda funcionalidade MUST rastrear ao identificador do requisito que a origina
  (RF/RNF/RN) na spec e nas tasks.
- Mudança que toque os princípios I, II ou IV MUST ter teste automatizado que prove o
  comportamento: negação de acesso por papel, tentativa de escrita em score e tentativa
  de acesso à rede dentro do sandbox.
- Nenhum commit é criado por agentes automatizados; a equipe versiona manualmente.
- O escopo é entregue por sprint conforme o cronograma do ERS. Funcionalidade fora da
  sprint corrente MUST NOT consumir tempo antes da entrega da sprint vigente.

## Governance

Esta constituição prevalece sobre qualquer outra prática, convenção de código ou
preferência individual da equipe do projeto CLTech.

- **Emendas**: qualquer alteração MUST ser proposta por escrito, indicando o princípio
  afetado, a motivação e o impacto nos artefatos existentes (spec, plan, tasks). A
  emenda só vale após aprovação da equipe e atualização deste arquivo.
- **Versionamento**: MAJOR para remoção ou redefinição incompatível de princípio; MINOR
  para novo princípio ou seção materialmente expandida; PATCH para esclarecimentos e
  correções sem mudança de significado.
- **Conformidade**: toda revisão de código MUST verificar aderência aos princípios. Um
  desvio só é aceito se registrado com justificativa explícita e plano de
  regularização; complexidade sem justificativa MUST ser recusada.
- **Princípios NÃO-NEGOCIÁVEIS** (I, II, IV) MUST NOT ser flexibilizados por prazo,
  conveniência de demonstração ou pressão de entrega.

**Version**: 1.0.0 | **Ratified**: 2026-09-12 | **Last Amended**: 2026-09-12
