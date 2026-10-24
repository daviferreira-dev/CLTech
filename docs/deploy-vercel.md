# Deploy na Vercel — passo a passo

Publica a aplicação em `https://<projeto>.vercel.app`, usando o mesmo banco e o mesmo storage
do Supabase que já funcionam localmente. Tempo estimado: 20 minutos. Custo: zero (plano Hobby).

O que **não** sobe para a Vercel: a execução de código do teste técnico, que precisa da VM com
Judge0 (decisão D2, Sprint 3). Sem ela, o candidato consegue abrir o desafio e submeter; a
correção fica "pendente" até a VM existir.

---

## 1. Antes de começar

- [ ] O código está no GitHub (`git push` da branch `main`).
- [ ] O `.env` local funciona: `pnpm dev` sobe e o login do recrutador entra.
- [ ] O banco já tem as migrações e o seed (já tem, se o passo anterior funcionou).

## 2. Criar o OAuth App do GitHub para produção

O OAuth App do GitHub aceita uma única URL de retorno, e a atual aponta para `localhost`.
Crie um segundo app só para produção:

1. https://github.com/settings/developers → **New OAuth App**
2. **Application name**: `CLTech (produção)`
3. **Homepage URL**: `https://cltech.vercel.app` (ajuste depois se a Vercel der outro nome)
4. **Authorization callback URL**: `https://cltech.vercel.app/api/auth/callback/github`
5. **Register application** → anote o **Client ID** → **Generate a new client secret** e anote o segredo.

## 3. Importar o projeto na Vercel

1. https://vercel.com/signup → entrar com a conta do GitHub.
2. **Add New… → Project** → escolha o repositório `CLTech` → **Import**.
3. Na tela de configuração, deixe:
   - **Framework Preset**: Next.js (detectado sozinho)
   - **Build Command**: padrão (`pnpm build`, que já roda `prisma generate`)
   - **Install Command**: padrão (a Vercel usa o pnpm por causa do `pnpm-lock.yaml`)
4. **Ainda não clique em Deploy**: abra **Environment Variables** (passo 4).

## 4. Variáveis de ambiente

Copie do `.env` local, **com os mesmos valores**, exceto onde a tabela diz outra coisa:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | igual ao `.env` |
| `AUTH_SECRET` | igual ao `.env` |
| `ENCRYPTION_KEY` | **igual ao `.env`**. Outra chave torna ilegíveis os telefones, currículos e códigos já gravados |
| `GITHUB_ID` / `GITHUB_SECRET` | os do OAuth App de **produção** (passo 2) |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | iguais ao `.env` |
| `NEXTAUTH_URL` | `https://cltech.vercel.app` (a URL final do projeto) |
| `LINKEDIN_ID` / `LINKEDIN_SECRET` | opcional; vazio esconde o botão |
| `SANDBOX_URL` / `SANDBOX_TOKEN` | deixar vazio até a VM existir |
| `CRON_SECRET` | opcional (ver item 7) |

Depois: **Deploy**. O primeiro build leva de 2 a 4 minutos.

## 5. Ajustes depois do primeiro deploy

1. **Região**: Project → **Settings → Functions → Function Region** → **São Paulo (gru1)**. O banco
   está em `sa-east-1`; com a função nos EUA, cada consulta atravessa o continente e o RNF03
   (≤ 3 s) fica em risco. Depois de mudar, **Deployments → ⋯ → Redeploy**.
2. **URL**: se a Vercel deu um nome diferente de `cltech.vercel.app`, atualize `NEXTAUTH_URL` e as
   duas URLs do OAuth App do GitHub, e faça **Redeploy**.

## 6. Conferir que funcionou

Na URL pública:

- [ ] `/vagas` lista as 5 vagas do seed, sem login.
- [ ] Login `recrutador@3aq.dev` / `Senha123!` cai em `/recrutamento` com o painel preenchido.
- [ ] Cadastro de um candidato novo, envio de um currículo **PDF** em `/perfil`: o perfil aparece
      pré-preenchido. Se aparecer "não foi possível ler o currículo", ver o item 8.
- [ ] Candidatura a uma vaga e o percentual de compatibilidade aparecendo na lista.
- [ ] "Entrar com GitHub" funciona.
- [ ] O cadeado do navegador mostra HTTPS (RNF01).

## 7. Limitações conhecidas no plano gratuito

| Limite | Efeito | O que fazer |
|---|---|---|
| Corpo de requisição de 4,5 MB | Currículo entre 4,5 e 5 MB é recusado pela Vercel antes de chegar ao sistema | Aceitável na demonstração; registrar se o professor testar com arquivo grande |
| Cron só 1 vez por dia, e a rota de expiração é `POST` | Não dá para agendar `POST /api/internal/code-tests/expire` pela Vercel | Não é necessário: o prazo também expira sempre que o candidato ou o recrutador abrem o desafio |
| Sem sandbox | Teste de código não é corrigido | VM do Judge0 na Sprint 3 |

## 8. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Build falha com `@prisma/client did not initialize yet` | `prisma generate` não rodou | Confirmar que o Build Command é o padrão (`pnpm build`) |
| Login com GitHub volta com erro `redirect_uri` | URL de retorno do OAuth App diferente da URL do projeto | Corrigir o passo 2 |
| Login com senha volta para `/entrar` sem erro | `AUTH_SECRET` ausente ou diferente | Conferir a variável e fazer Redeploy |
| `too many connections` nos logs | Muitas funções abrindo conexão ao mesmo tempo | Em `DATABASE_URL`, usar a porta `6543` do pooler do Supabase com `?pgbouncer=true&connection_limit=1` |
| Todo PDF cai em "não foi possível ler" | O worker do PDF não foi junto no deploy | Já tratado em `next.config.ts` (`outputFileTracingIncludes`); se acontecer, ver os logs da função `/api/me/resume` |

Logs: Project → **Logs** (filtrar por rota).
