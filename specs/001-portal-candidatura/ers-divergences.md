# Divergências entre o ERS e a especificação técnica

**Data**: 2026-09-12 · **ERS de referência**: `CLTech - ERS.docx` v1.0 (24/08/2026)

A constituição (seção *Fluxo de Desenvolvimento*) determina:

> O ERS é a fonte de verdade dos requisitos. Divergência entre código e ERS MUST ser
> resolvida atualizando um dos dois explicitamente, nunca no silêncio.

Este arquivo é esse registro. Cada item diz **o que o ERS pede**, **por que não é
implementado assim**, **o que foi feito no lugar** e **quem precisa agir**.

Nenhum item abaixo é uma discordância de opinião. São contradições internas do ERS,
incompatibilidades técnicas ou custos não previstos na tabela de viabilidade.

**Legenda de situação**
- 🔴 **Bloqueante** — impede a implementação literal; a decisão já foi tomada.
- 🟠 **Decisão pendente** — não bloqueia a sprint atual, precisa ser fechada antes da indicada.
- 🟢 **Resolvido** — divergência aceita e documentada; nada a fazer além de emendar o ERS.

---

<a id="d1"></a>

## D1 🔴 Cifrar nome e e-mail é incompatível com RN007 e RF09

**O ERS pede** (RNF01 e RNF05): *"Todo dado pessoal de candidatos (**nome, e-mail**,
currículo, links de LinkedIn/GitHub/Lattes) deve ser armazenado com criptografia em
repouso"*.

**Por que não é possível**: AES-256-GCM usa IV aleatório por registro — o mesmo e-mail
produz ciphertext diferente a cada gravação. Consequência direta:

| Requisito | O que exige do campo | O que a cifra impede |
|---|---|---|
| RN007 — um perfil por e-mail | índice **único** em `User.email` | valores iguais viram bytes diferentes; o índice não detecta duplicata |
| RF09 — buscar candidato por nome ou e-mail | busca parcial / `LIKE` | não se pesquisa dentro de ciphertext |

O ERS pede três coisas que não coexistem. Não é questão de esforço.

**O que foi feito** (decisão R4 do [research.md](./research.md)): criptografia **seletiva**
em coluna.

- **Cifrados** com AES-256-GCM: `Candidate.phone`, conteúdo do arquivo de currículo,
  `CodeSubmission.sourceCode`.
- **Em texto claro**: `User.email` (chave de identidade indexável, RN007) e `User.name`
  (buscável, RF09) — protegidos por criptografia de disco do provedor **e** por controle
  de acesso por papel verificado no servidor (FR-017 / RN004).

O espírito do RNF05 é cumprido: um dump de banco vazado não entrega telefone nem currículo,
e nome/e-mail sozinhos não constituem o dado sensível que a RN004 protege (relatório,
currículo, GitHub).

**Ação necessária**: emendar o RNF01 e o RNF05 do ERS para distinguir *dado pessoal
sensível cifrado em coluna* de *dado de identidade protegido por controle de acesso*.
Item obrigatório da auditoria de LGPD da Sprint 3 (cronograma, Semana 15).

---

<a id="d2"></a>

## D2 🔴 O RNF06 (sandbox) é incompatível com a hospedagem escolhida

**O ERS pede** (RNF06): *"sandbox isolado, sem acesso à rede ou ao sistema de arquivos do
host, com tempo máximo de execução de 10 segundos por submissão"*.

**Por que não é possível na infra atual**: a decisão R9 escolheu **Vercel Hobby**. Vercel é
serverless — não executa contêiner, não permite limitar CPU/memória por processo e não
isola rede por execução. O RNF06 exige exatamente essas três coisas.

Esta incompatibilidade **não havia sido percebida**: o `research.md` registrava "tecnologia
de sandbox" como incógnita aberta, sem notar que a decisão de hospedagem já fechada a
inviabilizava.

**O que foi decidido** — ver R10 no [research.md](./research.md): a execução de código sai
da Vercel para uma **VM dedicada**, mantendo custo zero:

| Opção | Custo | Observação |
|---|---|---|
| **Oracle Cloud Always Free** (escolhida) | R$ 0 permanente | 4 vCPU ARM + 24 GB; Docker + Judge0 ou Piston; exige cartão para verificação, não cobra |
| API pública do Piston | R$ 0 | plano B para a demonstração; rate limit de 5 req/s e código sai da infraestrutura |
| Judge0 via RapidAPI free | R$ 0 até 50 submissões/dia | suficiente para demo, insuficiente para uso real |

A aplicação Next.js continua na Vercel e fala com a VM por HTTP. **Impacto zero na Sprint
1**; a VM precisa estar provisionada e testada até o início da Sprint 3 (02/Nov).

**Ação necessária**: acrescentar a VM de sandbox à tabela de viabilidade do ERS (item
novo, R$ 0,00) e nomear um responsável pelo provisionamento antes de 02/Nov.

---

<a id="d3"></a>

## D3 🟠 Match na listagem de vagas não tem onde ser armazenado

**O ERS pede** (RF03, Fluxo Principal, passo 4): *"O sistema calcula e exibe o percentual
de match entre o perfil do candidato e os requisitos de **cada vaga**"* — na listagem,
antes da candidatura.

**Dois problemas**:

1. **Modelagem**: `Application.matchScore` só existe depois que o candidato se inscreve. O
   match da listagem é um par candidato × vaga **sem candidatura**. Não havia entidade para
   isso.
2. **Desempenho**: calcular NLP para N vagas a cada carregamento de página, com 50 usuários
   simultâneos, não cabe nos 3 s do RNF03.

**O que foi feito**: criada a entidade `JobMatch` 🟡 no [data-model.md](./data-model.md) —
score pré-calculado por par (`candidateId`, `jobId`), recalculado de forma assíncrona
quando o currículo ou a vaga muda, nunca no caminho da requisição. A listagem só lê.

**Situação na Sprint 1**: nenhum match é exibido (FR-026). A tabela nasce vazia. O
comportamento entra na Sprint 2, junto com o motor de triagem.

**Decisão pendente até o início da Sprint 2 (21/Set)**: o que exibir para um candidato sem
currículo, e se o match aparece para visitante não autenticado (não aparece — não há perfil
com que comparar).

---

<a id="d4"></a>

## D4 🟠 "Insights automáticos gerados pela IA" (RF07) é o único requisito que obriga a pagar

**O ERS pede** (RF07, Fluxo Principal, passo 5): *"O sistema exibe insights automáticos
gerados pela IA sobre o desempenho do funil de contratação"*.

**Três problemas**:

1. **Custo**: gerar texto analítico em prosa exige um LLM. É o único ponto do ERS inteiro
   que força custo recorrente por token — e a tabela de viabilidade não prevê nenhum.
2. **Contradição interna**: o [services/ai/README.md](../../services/ai/README.md) e a
   decisão R4 estabelecem que nenhum dado sai da infraestrutura e que a IA é determinística.
   Um LLM externo viola o Princípio I e o Princípio II.
3. **Não é verificável**: "insights" não tem critério de aceitação. Não dá para testar nem
   para avaliar.

**O que foi decidido**: o RF07 passa a entregar **métricas calculadas**, não texto gerado —
tempo médio por etapa, taxa de aprovação por etapa, gargalo do funil (etapa com maior
tempo de permanência) e comparação com o período anterior. Tudo derivável de
`ApplicationStageHistory` com agregação SQL.

Entrega o valor que a demanda pede ("o RH entende o funil") com custo zero, resultado
reproduzível e teste possível.

**Ação necessária**: reescrever o passo 5 do RF07 no ERS. Confirmar com o Prof. Wesley
Fioreze antes da Sprint 2 se a substituição é aceita — é a única mudança que reduz o
escopo funcional descrito na demanda.

---

<a id="d5"></a>

## D5 🟠 "Executar" código antes de submeter multiplica o uso do sandbox

**O ERS pede** (RF05, passo 4): *"O candidato escreve e **executa** o código no ambiente de
teste"* — e só depois (passo 5) submete.

**O problema**: a modelagem tratava o sandbox como invocado uma vez por submissão. Com
execução livre durante a escrita, são dezenas de invocações por candidato. Sobre a VM única
do D2, isso é o fator que dimensiona a capacidade — e um candidato sozinho pode monopolizá-la.

**O que foi feito** no [data-model.md](./data-model.md):

- `ProcessStage.config` ganha contrato explícito para a etapa `CODE_TEST`:
  `timeLimitMinutes`, `languages`, `difficulty`.
- Nova entidade `CodeDraft` 🟡 — rascunho com autosave, que existe porque o **RF05-A1**
  (*"tempo esgotado → envia o último estado salvo para correção"*) é impossível sem ele.
- `CodeSubmission.retryCount` — porque o **RF06-E1** exige *"reprocessa automaticamente a
  submissão até uma vez antes de notificar a equipe técnica"*, e não havia onde contar.

**Decisão pendente até o início da Sprint 3 (02/Nov)**: limite de execuções de teste por
candidato antes da submissão final (sugestão: 20) e fila com 1 execução simultânea por
candidato. Sem isso a VM cai sob uso normal, não sob ataque.

---

<a id="d6"></a>

## D6 🟠 RN005 (feedback por e-mail) não tem provedor nem custo previsto

**O ERS pede** (RN005): *"Todo candidato [...] receberá, obrigatoriamente, um feedback
automático **via e-mail**"*.

**O problema**: não há provedor de e-mail transacional na arquitetura nem na tabela de
viabilidade. Enviar e-mail a partir da aplicação sem um provedor dedicado resulta em
entrega na caixa de spam.

**O que foi decidido**: **Resend** no tier gratuito (3.000 e-mails/mês, 100/dia) — folgado
para o volume do protótipo, R$ 0. O e-mail do candidato é o único dado pessoal que sai da
infraestrutura, com finalidade declarada (notificar o próprio titular), o que é compatível
com o Princípio I.

**Situação**: RN005 está classificada como **Desejável** no próprio ERS (seção 2.4) e o
cronograma a coloca na Semana 15 (Sprint 3). Não afeta as Sprints 1 e 2.

**Ação necessária**: acrescentar o provedor de e-mail à tabela de viabilidade (R$ 0,00).

---

<a id="d7"></a>

## D7 🟢 Editar pipeline de vaga publicada reprocessa scores — e isso é compatível com a RN003

**O ERS pede** (RF04-A2): *"Se o recrutador editar o pipeline de uma vaga com candidatos já
em andamento, o sistema alerta sobre o impacto antes de confirmar e **reprocessa o score**
dos candidatos já inscritos"*.

**Por que parecia conflito**: a RN003 declara o score imutável. Reprocessar parece editá-lo.

**Por que não é**: o reprocessamento **insere uma nova linha** `Evaluation` com
`version + 1`. A anterior permanece intacta e auditável. A leitura corrente é a de maior
`version`. Nenhum registro é alterado — a imutabilidade vale por linha, não por candidatura.

**O que é obrigatório**: o alerta ao recrutador antes de confirmar (previsto no próprio
RF04-A2) e o registro de que o ranking dos já inscritos pode mudar no meio do processo.

Nada a fazer. Registrado para que a Sprint 2 não trate isso como violação da RN003 e
implemente um caminho errado.

---

<a id="d8"></a>

## D8 🟢 A listagem de vagas é pública

**O ERS pede** (RF03, Pré-condições): *"Candidato autenticado [RF01] com perfil preenchido
[RF02]"* para acessar a busca de vagas.

**O que foi feito** (FR-018, FR-023): a listagem e o detalhe da vaga são **públicos**; a
autenticação é exigida apenas no ato de se candidatar, e o candidato retorna à vaga de
origem depois de entrar.

**Por quê**: exigir cadastro para *ver* vagas contraria a missão declarada no próprio ERS
(seção 1.2.3) — *"facilitar o acesso de talentos às vagas"* — e o problema de negócio que
motiva o projeto (atrito no funil de entrada). Toda plataforma de recrutamento do mercado
expõe vagas publicamente; é o que traz candidato.

Não há perda de segurança: vaga publicada não é dado pessoal, e o RF03 passo 4 (match) não
é exibido para quem não está autenticado, por não haver perfil com que comparar (ver D3).

**Ação necessária**: corrigir as pré-condições do RF03 no ERS.

---

<a id="d9"></a>

## D9 🟢 LinkedIn e Lattes não fornecem dados coletáveis

**O ERS pede** (RF02): *"conectar contas externas (**LinkedIn, GitHub e Lattes**)"*, e o
RF02-A1 dispara coleta automática ao conectar.

**A realidade de cada provedor**:

| Provedor | O que dá para coletar |
|---|---|
| **GitHub** | tudo que o ERS pede — linguagens, repositórios públicos, frequência de atividade |
| **LinkedIn** | apenas nome, e-mail e foto (OpenID Connect). A API **não expõe** experiência, skills nem formação para aplicações comuns |
| **Lattes** | nenhuma API pública; a consulta é protegida por CAPTCHA e o scraping viola os termos de uso |

**O que foi feito**: LinkedIn serve como **provedor de autenticação** (FR-002) e link de
perfil; Lattes é **link manual** (campo `url` em `ExternalAccount`). Só o GitHub tem coleta
automática (FR-011), e a entidade `GithubProfile` existe apenas para ele.

Já estava correto no modelo. Registrado para que ninguém tente implementar a coleta do
LinkedIn e perca a sprint descobrindo que a API não devolve o dado.

---

## Resumo das ações sobre o ERS

Para a próxima revisão do documento (v1.1):

| # | Seção do ERS | Ação | Prazo |
|---|---|---|---|
| D1 | RNF01, RNF05 | Distinguir dado sensível cifrado de dado de identidade protegido por acesso | Sprint 3 (auditoria LGPD) |
| D2 | 1.2.4 Tabela de viabilidade | Acrescentar VM de sandbox (R$ 0,00) | antes de 02/Nov |
| D3 | RF03 passo 4 | Esclarecer que o match é pré-calculado, não em tempo real | antes de 21/Set |
| D4 | RF07 passo 5 | Trocar "insights gerados pela IA" por métricas calculadas — **exige aval do professor** | antes de 21/Set |
| D5 | RF05, RF06-E1 | Definir limite de execuções antes da submissão | antes de 02/Nov |
| D6 | 1.2.4 Tabela de viabilidade | Acrescentar provedor de e-mail (R$ 0,00) | antes de 09/Nov |
| D8 | RF03 pré-condições | Listagem de vagas é pública | próxima revisão |
| D9 | RF02 | LinkedIn e Lattes são link, não coleta | próxima revisão |
