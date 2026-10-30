# Deploy na Vercel — passo a passo

Publica a aplicação em `https://<projeto>.vercel.app`, usando o mesmo banco e o mesmo storage
do Supabase que já funcionam localmente. Tempo estimado: 15 minutos. Custo: zero (plano Hobby).

O que **não** sobe para a Vercel: a execução de código do teste técnico, que precisa da VM com
Judge0 (decisão D2). Sem ela, o candidato consegue abrir o desafio e submeter; a correção fica
"pendente" até a VM existir. `SANDBOX_URL="local"` é ignorado em produção.

O repositório já traz o que dá para deixar pronto:

| Arquivo | O que faz |
|---|---|
| `vercel.json` | Fixa a função em **São Paulo (`gru1`)**, perto do banco em `sa-east-1` (RNF03 ≤ 3 s) |
| `.env.vercel.local` | Variáveis de produção prontas para colar, geradas do `.env`. **Não versionado** (`.gitignore` cobre `*.local`); existe só na máquina de quem gerou |

---

## 1. Antes de começar

- [ ] `git pull` feito e `vercel.json` commitado e enviado (`git push`). A Vercel publica o que
      está no GitHub, não o que está na sua máquina.
- [ ] Migrações aplicadas no banco: `pnpm prisma migrate status` deve dizer que está em dia.
      Se não estiver, `pnpm prisma migrate deploy`. **A Vercel não aplica migrações.**
- [ ] Seed presente: `pnpm db:seed` (idempotente; rodar de novo não duplica nada).

## 2. Criar o OAuth App do GitHub para produção

O OAuth App do GitHub aceita uma única URL de retorno, e a atual aponta para `localhost`.
Crie um segundo app só para produção:

1. https://github.com/settings/developers → **New OAuth App**
2. **Application name**: `CLTech (produção)`
3. **Homepage URL**: `https://cltech-3aq.vercel.app` (ajuste depois se a Vercel der outro nome)
4. **Authorization callback URL**: `https://cltech-3aq.vercel.app/api/auth/callback/github`
5. **Register application** → anote o **Client ID** → **Generate a new client secret** e anote o segredo.

**LinkedIn** (opcional): no app do LinkedIn, em *Auth → Authorized redirect URLs*, adicione
`https://cltech-3aq.vercel.app/api/auth/callback/linkedin`. O LinkedIn aceita várias URLs, então a
de `localhost` continua valendo. Se não for usar, apague `LINKEDIN_ID` e `LINKEDIN_SECRET` do
arquivo de variáveis: vazio esconde o botão.

## 3. Preparar o arquivo de variáveis

Abra `.env.vercel.local` e troque os três valores marcados com `TROCAR`:

| Variável | Valor |
|---|---|
| `GITHUB_ID` / `GITHUB_SECRET` | os do OAuth App de **produção** (passo 2) |
| `NEXTAUTH_URL` | `https://cltech-3aq.vercel.app` (a URL final do projeto, sem barra no fim) |

O resto já vem do `.env`, com um ajuste: o `DATABASE_URL` usa a **porta 6543** do pooler do
Supabase com `?pgbouncer=true&connection_limit=1`, o modo recomendado para funções
serverless. Na porta 5432 (a do `.env` local), várias funções abertas ao mesmo tempo esgotam
as conexões do plano gratuito.

Se o arquivo não existir (outra máquina), monte-o a partir da tabela:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | a do `.env`, trocando `:5432/` por `:6543/` e acrescentando `?pgbouncer=true&connection_limit=1` |
| `AUTH_SECRET` | igual ao `.env` |
| `ENCRYPTION_KEY` | **igual ao `.env`**. Outra chave torna ilegíveis os telefones, currículos e códigos já gravados |
| `GITHUB_ID` / `GITHUB_SECRET` | os do OAuth App de **produção** |
| `GITHUB_COLLECTION_TOKEN` | igual ao `.env` (coleta de portfólio com limite de requisições maior) |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | iguais ao `.env` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | iguais ao `.env` (e-mails ao candidato, RN005). Vazios desligam o envio sem quebrar nada |
| `NEXTAUTH_URL` | a URL pública do projeto |
| `LINKEDIN_ID` / `LINKEDIN_SECRET` | opcional |
| `CRON_SECRET` | opcional (ver item 7) |
| `SANDBOX_URL` / `SANDBOX_TOKEN` | vazios até a VM existir |

Não vão para a Vercel: `AI_SERVICE_URL` e `GEMINI_API_KEY` (sem uso; a triagem roda no
próprio Next.js, decisão D11) e `SANDBOX_ALLOW_LOCAL`.

## 4. Importar o projeto na Vercel

1. https://vercel.com/signup → entrar com a conta do GitHub.
2. **Add New… → Project** → escolha o repositório `CLTech` → **Import**.
3. Na tela de configuração, deixe tudo no padrão: Framework **Next.js**, Build Command
   `pnpm build` (já roda `prisma generate`), Install Command padrão.
4. Abra **Environment Variables**, clique no campo da primeira variável e **cole o conteúdo
   inteiro** do `.env.vercel.local`: a Vercel separa as variáveis sozinha. Confira se apareceram
   todas e se nenhuma ficou com `TROCAR`.
5. **Deploy**. O primeiro build leva de 2 a 4 minutos.

A região já vem de `vercel.json`; não precisa mexer em *Settings → Functions*.

## 5. Ajustes depois do primeiro deploy

1. **URL**: se a Vercel deu um nome diferente de `cltech-3aq.vercel.app`, atualize `NEXTAUTH_URL`
   (Settings → Environment Variables), as duas URLs do OAuth App do GitHub e, se usar, a do
   LinkedIn. Depois: **Deployments → ⋯ → Redeploy**. Variável alterada só vale após redeploy.
2. **Região**: em Deployments → (deploy) → **Functions**, confirme `gru1`.

## 6. Conferir que funcionou

Na URL pública:

- [ ] `/vagas` lista as vagas do seed, sem login.
- [ ] Login `recrutador@3aq.dev` / `Senha123!` cai em `/recrutamento` com o painel preenchido.
- [ ] Cadastro de um candidato novo, envio de um currículo **PDF** em `/perfil`: o perfil aparece
      pré-preenchido. Se aparecer "não foi possível ler o currículo", ver o item 8.
- [ ] Candidatura a uma vaga e o percentual de compatibilidade aparecendo na lista.
- [ ] Recrutador avança a candidatura de etapa: o candidato recebe o e-mail (se SMTP configurado).
- [ ] "Entrar com GitHub" funciona.
- [ ] O cadeado do navegador mostra HTTPS (RNF01).

## 7. Limitações conhecidas no plano gratuito

| Limite | Efeito | O que fazer |
|---|---|---|
| Corpo de requisição de 4,5 MB | Currículo entre 4,5 e 5 MB é recusado pela Vercel antes de chegar ao sistema | Aceitável na demonstração; registrar se o professor testar com arquivo grande |
| Cron só 1 vez por dia, e a rota de expiração é `POST` | Não dá para agendar `POST /api/internal/code-tests/expire` pela Vercel | Não é necessário: o prazo também expira sempre que o candidato ou o recrutador abrem o desafio |
| Sem sandbox | Teste de código não é corrigido | VM do Judge0 |
| Supabase gratuito pausa após inatividade | Toda rota com banco falha | Restaurar o projeto no painel do Supabase antes de apresentar |

## 8. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Build falha com `ERR_PNPM_OUTDATED_LOCKFILE` | `package.json` mudou sem atualizar o `pnpm-lock.yaml` | `pnpm install` local e commitar o lockfile |
| Build falha com `@prisma/client did not initialize yet` | `prisma generate` não rodou | Confirmar que o Build Command é o padrão (`pnpm build`) |
| Erro 500 com `column ... does not exist` | Migração não aplicada no banco | `pnpm prisma migrate deploy` local (passo 1) |
| Login com GitHub volta com erro `redirect_uri` | URL de retorno do OAuth App diferente da URL do projeto | Corrigir o passo 2 |
| Login com senha volta para `/entrar` sem erro | `AUTH_SECRET` ausente ou diferente | Conferir a variável e fazer Redeploy |
| `too many connections` / `max clients reached` nos logs | `DATABASE_URL` na porta 5432 | Usar a porta `6543` com `?pgbouncer=true&connection_limit=1` (passo 3) |
| Todo PDF cai em "não foi possível ler" | O worker do PDF não foi junto no deploy | Já tratado em `next.config.ts` (`outputFileTracingIncludes`); se acontecer, ver os logs da função `/api/me/resume` |
| E-mail não chega | SMTP vazio, ou senha normal do Gmail em vez de "senha de app" | Ver os comentários de SMTP no `.env.example` |

Logs: Project → **Logs** (filtrar por rota).
