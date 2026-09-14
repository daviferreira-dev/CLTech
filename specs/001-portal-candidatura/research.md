# Research — Portal de Candidatura (Sprint 1)

**Data**: 2026-09-12
**Spec**: [spec.md](./spec.md)
**Constituição**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)

Cada item abaixo resolve uma incógnita do Technical Context. O critério de desempate,
sempre que duas opções eram tecnicamente equivalentes, foi o Princípio VI da
constituição: menos peças, custo recorrente baixo e manutenível pela 3aq.

---

## R1. Arranjo da aplicação — Next.js único vs. front + back separados

**Decisão**: uma aplicação Next.js (App Router, TypeScript) contendo as telas React e
as rotas de API em Node, no mesmo repositório. O serviço Python/FastAPI existe no
monorepo como pasta reservada (`services/ai`), sem código funcional nesta sprint.

**Rationale**: o ERS exige React + Node + Python. Next.js entrega React e Node em um
único processo e um único deploy, o que corta metade do trabalho de infraestrutura numa
sprint de 2 dias e mantém o custo dentro do orçamento (Princípio VI). O Python só é
necessário quando a IA entrar, na Sprint 2 — criar o serviço agora seria manter uma peça
vazia.

**Alternativas consideradas**:
- *React/Vite + Express separados*: mais fiel à leitura literal do ERS e mais fácil de
  paralelizar entre 6 pessoas, mas dobra o setup (CORS, dois deploys, dois ambientes) sem
  benefício antes da Sprint 2.
- *FastAPI como backend único servindo o React*: descartado porque contraria a exigência
  explícita de Node na demanda.

**Risco aceito**: se a equipe decidir depois mover a API para fora do Next.js, a migração
custa reescrever os route handlers. Mitigado mantendo a lógica de negócio em
`src/server/` (funções puras testáveis) e deixando os route handlers como casca fina.

---

## R2. Autenticação e OAuth

**Decisão**: Auth.js (NextAuth v5) com três provedores — Credentials (e-mail + senha),
GitHub e LinkedIn — e sessão em banco (`database` strategy), não JWT.

**Rationale**:
- Cobre FR-001 a FR-006 sem escrever fluxo OAuth à mão.
- Sessão em banco permite revogação imediata e auditoria de acesso, exigidas pelo
  Princípio I; JWT stateless não permite invalidar uma sessão vazada.
- O adapter grava contas de provedores externos em tabela separada, o que resolve
  FR-003 (vincular GitHub/LinkedIn a uma conta existente pelo e-mail) sem modelagem extra.

**Senhas**: hash com Argon2id (fallback bcrypt cost ≥ 12 se a hospedagem não suportar
binário nativo). Atende FR-007.

**Alternativas consideradas**:
- *Auth artesanal com cookies de sessão*: mais controle, mas escrever OAuth 2.0 correto
  (state, PKCE, troca de token) em 2 dias é risco desnecessário.
- *Serviço gerenciado (Clerk/Auth0)*: rápido, porém custo recorrente por usuário ativo e
  dado pessoal de candidato saindo para terceiro — colide com Princípio I e VI.

**Dependência externa de risco**: o LinkedIn exige que o app tenha o produto
"Sign In with LinkedIn using OpenID Connect" aprovado no portal de desenvolvedores, e a
liberação não é instantânea. **Mitigação**: GitHub e e-mail/senha são o caminho crítico;
o botão do LinkedIn entra atrás de uma flag e pode ser desligado sem afetar FR-001,
FR-004 e FR-006. Isso está registrado como suposição na spec.

---

## R3. Banco de dados e camada de acesso

**Decisão**: PostgreSQL com Prisma como ORM e Prisma Migrate para versionar o schema.

**Rationale**: o modelo é fortemente relacional (candidato → candidatura → etapa →
avaliação) e tem regra de unicidade composta (um candidato por vaga, FR-022) que o banco
resolve com constraint em vez de código. Prisma dá schema declarativo, migrações
versionadas e tipos TypeScript gerados — os tipos nas fronteiras são exigência do
Princípio VI. A equipe é de 6 pessoas em formação: schema declarativo em um arquivo é
mais fácil de revisar em grupo do que migrações SQL escritas à mão.

**Alternativas consideradas**:
- *Drizzle*: mais leve e SQL-first, porém a equipe ganha menos com isso do que perde em
  curva de aprendizado sob prazo.
- *MongoDB*: descartado — o ERS especifica banco relacional e o domínio é relacional.

**Hospedagem**: Postgres gerenciado em tier gratuito (Neon ou Supabase) para o protótipo,
com criptografia de disco pelo provedor. Sobe para o plano pago apenas se a demonstração
exigir. Cabe no orçamento de R$ 30/mês da tabela de viabilidade.

---

## R4. Criptografia de dados pessoais em repouso (Princípio I / FR-016)

**Decisão**: duas camadas.
1. **Disco**: criptografia em repouso do provedor de banco e do storage de arquivos
   (padrão nos tiers gerenciados).
2. **Coluna**: criptografia de aplicação AES-256-GCM sobre os campos pessoais mais
   sensíveis — telefone, e o conteúdo do arquivo de currículo. Chave em variável de
   ambiente (`ENCRYPTION_KEY`, 32 bytes em base64), IV aleatório por registro, authTag
   armazenado junto. Implementado em `src/server/crypto.ts` com API mínima:
   `encrypt(plaintext): string` e `decrypt(ciphertext): string`.

**Rationale**: só disco não atende ao espírito do RNF05 (um dump de banco vazado
continuaria legível para quem tem acesso ao arquivo). Criptografar *tudo* na coluna,
porém, quebra busca e ordenação — e-mail precisa ser indexável e único (RN007), nome
precisa ser buscável na Sprint 2 (RF09). Por isso a escolha é seletiva e documentada.

**E-mail e nome**: ficam em texto claro. Não é preferência — é **impossível** cifrá-los e
cumprir a RN007 e o RF09 ao mesmo tempo. O AES-256-GCM usa IV aleatório por registro, então
o mesmo e-mail vira ciphertext diferente a cada gravação: o índice único da RN007 não
detecta duplicata e a busca por nome do RF09 não encontra nada. O ERS pede três coisas que
não coexistem — divergência registrada e resolvida em [D1](./ers-divergences.md#d1).

Ambos ficam protegidos por controle de acesso por papel (FR-017) e criptografia de disco.
**A justificativa é item obrigatório da auditoria de LGPD da Sprint 3** (cronograma do ERS,
Semana 15).

**Rotação de chave**: fora de escopo desta sprint; o formato do ciphertext já carrega um
prefixo de versão (`v1:`) para tornar a rotação possível depois sem migração destrutiva.

**Alternativas consideradas**:
- *pgcrypto no banco*: move a chave para perto do dado cifrado, o que reduz o benefício.
- *Criptografar todos os campos*: inviabiliza índices e busca; custo alto, ganho marginal.

---

## R5. Armazenamento do arquivo de currículo

**Decisão**: object storage compatível com S3 (Supabase Storage no tier gratuito), bucket
**privado**, acesso apenas por URL assinada de curta duração gerada no servidor após
verificação de papel (FR-017). Conteúdo cifrado com AES-256-GCM antes do upload (R4).

**Rationale**: salvar no filesystem do host quebra em qualquer deploy serverless e não
sobrevive a redeploy. Bucket público violaria FR-017 diretamente — um link vazado exporia
currículo de candidato.

**Validação (FR-014)**: dupla — no cliente para feedback imediato e no servidor como
autoridade. O servidor confere extensão, MIME declarado, tamanho ≤ 5 MB e o *magic number*
do arquivo (`%PDF` para PDF, `PK\x03\x04` para DOCX), porque extensão e MIME são
falsificáveis.

**Alternativas consideradas**:
- *BLOB no Postgres*: simples, mas infla backups e o tier gratuito tem limite baixo de
  armazenamento.
- *Cloudflare R2*: tecnicamente equivalente; Supabase escolhido por já ser candidato a
  fornecer o Postgres, reduzindo uma conta a administrar.

---

## R6. Integração com a API do GitHub (FR-011, FR-012)

**Decisão**: coleta server-side via REST API do GitHub, usando o access token do OAuth
quando disponível e caindo para chamadas não autenticadas quando não houver. Três
chamadas: dados do usuário, lista de repositórios públicos e eventos públicos recentes
(para frequência de atividade). Linguagens derivadas do campo `language` dos repositórios,
ponderadas por tamanho.

**Resultado persistido como snapshot** (entidade `GithubProfile`) com `collectedAt`, e
**não** consultado ao vivo a cada visualização: a API do GitHub tem rate limit (60 req/h
sem autenticação, 5.000 req/h autenticada) e o RNF03 exige resposta em 3 s.

**Tratamento de falha (FR-012)**: qualquer erro — 404, perfil privado, rate limit,
timeout — grava o vínculo com estado `UNAVAILABLE` e o motivo, e **nunca** propaga exceção
para o fluxo de candidatura. Retentativa é manual pelo candidato (FR-013) nesta sprint.

**Execução**: a coleta roda fora do request de conexão (fire-and-forget com registro de
estado `PENDING`), para que o candidato não fique esperando a API de terceiro.

---

## R7. Modelagem antecipada das Sprints 2 e 3 (FR-027, FR-028)

**Decisão**: o schema desta sprint já inclui `ProcessStage`, `ApplicationStageHistory`,
`Evaluation` e `CodeSubmission`, mas apenas `ProcessStage` e `ApplicationStageHistory`
têm comportamento nesta entrega. `Evaluation` e `CodeSubmission` são criadas vazias.

**Imutabilidade do score (Princípio II / FR-028)**: garantida em três níveis —
(a) não existe rota de update para `Evaluation`; (b) a tabela tem `version` e cada
reprocessamento insere nova linha em vez de alterar a anterior; (c) uma trigger de banco
`REVOKE UPDATE` / `BEFORE UPDATE ... RAISE EXCEPTION` bloqueia alteração mesmo por acesso
direto ao banco. O teste automatizado exigido pela constituição tenta o update e espera
falha.

**Rationale**: mudar schema com dados já cadastrados no meio da Sprint 2 custa mais caro
que modelar agora. O risco de modelar cedo demais (campos que se revelam errados) é baixo
porque as entidades vêm descritas no ERS.

---

## R8. Estratégia de testes

**Decisão**:
- **Vitest** para unidade e integração de servidor (regras de negócio em `src/server/`).
- **Playwright** para os fluxos ponta a ponta das três histórias P1 e para a verificação
  de responsividade em 360 px e 1280 px (SC-006).
- **Postgres efêmero via Docker** para os testes de integração, com o mesmo schema de
  produção — testar constraint de unicidade contra mock não prova nada.

**Testes obrigatórios pela constituição** (não negociáveis, precisam existir nesta sprint):
1. Usuário sem papel de recrutador recebe negação ao pedir currículo de outro candidato
   (Princípio I, FR-017).
2. Tentativa de `UPDATE` em `Evaluation` falha (Princípio II, FR-028).
3. Duas candidaturas simultâneas do mesmo candidato à mesma vaga resultam em uma só
   (FR-022, SC-003).

O teste de sandbox sem rede exigido pelo Princípio IV não se aplica a esta sprint —
não há execução de código de candidato ainda.

---

## R9. Hospedagem e custo

**Decisão**: Vercel (tier Hobby) para a aplicação Next.js + Neon (tier gratuito) para
Postgres + Supabase Storage (tier gratuito) para os currículos. Subdomínio `*.vercel.app`;
o domínio próprio da tabela de viabilidade é opcional.

| Camada | Serviço | Tier | Limite que importa |
|---|---|---|---|
| Aplicação | Vercel Hobby | grátis | 100 GB de banda/mês |
| Banco | Neon | grátis | 0,5 GB; hiberna após inatividade |
| Currículos | Supabase Storage | grátis | 1 GB ≈ 200 arquivos de 5 MB |
| Serviço de IA (Sprint 2) | Vercel Python Functions | grátis | 250 MB de bundle — cabe em NLP leve |
| Sandbox (Sprint 3) | Oracle Cloud Always Free | grátis | ver R10 |
| E-mail (Sprint 3) | Resend | grátis | 3.000/mês, 100/dia — ver R11 |

**Custo recorrente do protótipo: R$ 0/mês.** Os R$ 2.000 da tabela de viabilidade do ERS
são mão de obra da própria equipe, não desembolso.

**Contrapartida assumida**: tiers gratuitos hibernam. O primeiro acesso após inatividade
custa de 1 s (Neon) a ~50 s (serviços que dormem por completo), o que fura o RNF03 (3 s) e
o RNF02 (95% de disponibilidade). Ambos estão classificados como **Desejável** na seção 2.4
do ERS, então a troca é defensável para um protótipo — **mas precisa ser dita na
apresentação, não descoberta pelo avaliador**. Mitigação barata: um ping agendado mantendo
o banco acordado em horário comercial.

---

## R10. Onde o sandbox de execução de código roda (Princípio IV / RNF06)

**Problema descoberto na revisão do ERS**: a decisão R9 (Vercel Hobby) é **incompatível**
com o RNF06. Vercel é serverless — não executa contêiner, não permite limitar CPU e memória
por processo e não isola rede por execução. O RNF06 exige as três coisas. Ver
[D2](./ers-divergences.md#d2).

**Decisão**: a execução de código sai da Vercel para uma **VM dedicada na Oracle Cloud
Always Free** (4 vCPU ARM + 24 GB, gratuita por tempo indeterminado), rodando **Judge0** em
Docker. A aplicação Next.js permanece na Vercel e fala com a VM por HTTP autenticado.

**Rationale**: é a única opção que atende ao RNF06 de verdade (contêiner descartável, sem
rede, com `ulimit`) mantendo o custo em R$ 0 e o código do candidato **dentro da
infraestrutura do projeto** — o que o Princípio I pede.

**Alternativas consideradas**:
- *API pública do Piston* (`emkc.org`): zero setup, mas rate limit de 5 req/s e o código do
  candidato sai para terceiro. Mantida como **plano B para a demonstração**, caso a VM não
  esteja pronta.
- *Judge0 via RapidAPI, tier free*: 50 submissões/dia. Suficiente para demo, insuficiente
  para uso real, e também envia código a terceiro.
- *Fly.io / Railway*: não têm mais tier gratuito permanente.
- *Executar na própria aplicação com `vm2` ou similar*: descartado sem discussão — sandbox
  em processo não é isolamento e o Princípio IV é não-negociável.

**Risco de prazo**: a VM precisa estar provisionada e testada **antes de 02/Nov** (início da
Sprint 3 no cronograma). A criação da conta Oracle exige cartão para verificação de
identidade (não há cobrança) e a aprovação não é instantânea — começar cedo.

**Dimensionamento**: ver [D5](./ers-divergences.md#d5). O fator de carga não é a submissão
final, é a execução livre durante a escrita (RF05 passo 4). Teto de execuções por candidato
e fila de 1 execução simultânea por candidato são obrigatórios, senão a VM cai sob uso
normal.

---

## R11. Envio de e-mail (RN005)

**Decisão**: **Resend** no tier gratuito (3.000 e-mails/mês, 100/dia).

**Rationale**: enviar SMTP direto da aplicação entrega na caixa de spam; um provedor
transacional resolve SPF/DKIM. O volume do protótipo é de dezenas de e-mails. Custo R$ 0.

**Princípio I**: o e-mail do candidato é o único dado pessoal que sai da infraestrutura, com
finalidade declarada e minimização — o corpo da mensagem leva status e nome, **nunca** score
detalhado, currículo ou dados de GitHub.

**Situação**: RN005 é **Desejável** no ERS e o cronograma a coloca na Semana 15. Não afeta
as Sprints 1 e 2.

---

## Incógnitas remanescentes

Nenhuma bloqueia o início da implementação.

**Fechadas nesta revisão** (eram as duas registradas na versão anterior):

1. ~~Provedor de LLM para a triagem~~ → **não haverá LLM.** A triagem é NLP determinístico
   (ver [services/ai/README.md](../../services/ai/README.md)), exigência combinada dos
   Princípios I, II e VI. A única parte do ERS que forçaria um LLM é o RF07 ("insights
   automáticos"), substituído por métricas calculadas — ver [D4](./ers-divergences.md#d4).
2. ~~Tecnologia de sandbox~~ → **Judge0 em VM Oracle Cloud Always Free** (R10).

**Abertas, com prazo**:

| Incógnita | Decidir até | Impacto se não decidir |
|---|---|---|
| Aval do professor sobre a substituição do RF07 ([D4](./ers-divergences.md#d4)) | 21/Set | é a única mudança que reduz escopo funcional da demanda |
| Teto de execuções de teste por candidato ([D5](./ers-divergences.md#d5)) | 02/Nov | a VM de sandbox cai sob uso normal |
| O que exibir de match para candidato sem currículo ([D3](./ers-divergences.md#d3)) | 21/Set | estado vazio indefinido na listagem |
