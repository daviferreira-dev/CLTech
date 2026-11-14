# Incidente, rollback e backup

> **Site fora do ar agora?**
> 1. Vercel → projeto → quadro **Production Deployment** → **Instant Rollback** → **Confirm Rollback**.
> 2. GitHub → Actions → **Smoke de produção** → **Run workflow**, e espere ficar verde.
> 3. Só depois, com calma: `git revert` num PR e desfazer o rollback (seção 1, passos 4 a 6).

O que fazer quando a produção (`https://cltech-3aq.vercel.app`) quebra, quando uma migration
estraga dados, e como restaurar o backup semanal. Ligado de [deploy-vercel.md](deploy-vercel.md).

Duas coisas para ter em mente:

- **Código e banco voltam separados.** O Instant Rollback da Vercel volta só o código. O banco
  fica como está, com as migrations já aplicadas. Por isso as migrations só adicionam (ver
  [CONTRIBUTING](../.github/CONTRIBUTING.md#regras)): o código anterior continua funcionando com
  um banco que só ganhou coisas.
- **O Supabase grátis não tem backup próprio** (nem diário, nem PITR). O único backup é o do
  workflow [`backup-banco.yml`](../.github/workflows/backup-banco.yml), uma vez por semana. No
  pior caso se perde até uma semana de dados. Antes de qualquer coisa arriscada no banco, rode
  um backup à mão (Actions → **Backup do banco** → **Run workflow**).

---

## 1. O smoke falhou ou a produção quebrou

O smoke ([`smoke-producao.yml`](../.github/workflows/smoke-producao.yml)) roda depois de cada
deploy de produção. Falhou, ou alguém avisou que o site caiu. Siga na ordem:

1. **Confirmar.** Abra o site e a execução do smoke (Actions → Smoke de produção). Veja os logs
   na Vercel (Project → **Logs**). Se o erro for "banco pausado" ou "too many connections", não é
   o deploy: ver [deploy-vercel.md, item 8](deploy-vercel.md#8-problemas-comuns), e pare aqui.
2. **Voltar o código.** Vercel → página do projeto → quadro **Production Deployment** →
   **Instant Rollback** → confira → **Confirm Rollback**. É na hora. No plano Hobby ele só volta
   para o deploy **imediatamente anterior**, e as variáveis de ambiente não mudam.
3. **Conferir.** Actions → Smoke de produção → **Run workflow**. Verde: o site está de pé com o
   código anterior. Vermelho: o anterior também está ruim. Nos dois casos continue no passo 4,
   porque quem resolve de vez é o deploy do revert.
4. **Reverter pelo Git, num PR.** Nunca empurre direto na `main`.

   ```bash
   git switch main
   git pull
   git switch -c fix/revert-<assunto>
   git revert -m 1 <sha-do-merge-do-PR-ruim>
   git push -u origin fix/revert-<assunto>
   ```

   Cada PR entra na `main` como um commit "Merge pull request #N" (`git log --oneline main`
   mostra); o `-m 1` desfaz o PR inteiro. Para um commit comum, sem `-m 1`. Se o problema era só
   uma variável de ambiente, corrija a variável em vez de reverter código. Abra o PR, espere o CI
   ficar verde e faça o merge.

   Depois do rollback a Vercel desliga a promoção automática: o merge gera um deploy de produção,
   mas ele **não vai ao ar sozinho**. É o passo 5.
5. **Desfazer o rollback.** Quando o deploy do merge terminar na Vercel: quadro **Production
   Deployment** → **Manage** → escolha esse deploy → **Confirm**. Pela linha de comando:
   `vercel promote <url-do-deploy>`. Isso põe o deploy no ar e religa a promoção automática.
6. **Conferir de novo.** Actions → Smoke de produção → **Run workflow**.

**O deploy quebrado tinha migration?** O rollback não desfaz a migration. Se ela só adicionou
(tabela, coluna nullable, índice), o código antigo ignora e está tudo bem. Se ela apagou ou
mudou algo, vá para a seção 2.

## 2. Uma migration estragou dados

O Prisma não desfaz migration, e o build de produção aplica a migration antes de o código novo
subir.

1. **Parar o estrago.** Não faça merge de nada com migration até resolver. Se o código novo está
   gravando dado errado, faça o rollback da seção 1.
2. **Entender o tamanho.** Foi estrutura (coluna errada, tipo errado) ou dado (linhas apagadas,
   valores trocados)?
   - **Só estrutura, sem perda:** corrija com uma migration **nova** que conserta para frente. Não
     edite a migration já aplicada: o Prisma não roda de novo.
   - **Dado perdido:** o dado só existe no último backup. Siga a seção 3, **primeiro num banco
     local**, e compare com o que está em produção.
3. **Decidir como devolver.** Prefira devolver só o que se perdeu (uma tabela, umas linhas),
   copiando do banco local restaurado. Restaurar o backup inteiro em produção apaga tudo o que
   aconteceu depois dele (candidaturas, avaliações, contas novas). Essa decisão é do Davi,
   explícita, depois de ver o banco restaurado.

## 3. Baixar, decifrar e restaurar um backup

O backup é um `pg_dump` (formato custom, só o schema `public`) cifrado com gpg AES256. Fica 30
dias como artifact de cada execução do workflow. O repositório é público: o artifact pode ser
baixado por qualquer conta do GitHub, por isso ele só sai cifrado. Quem não tem a senha de cifra
não abre.

O que **não** está no backup:
- os arquivos de currículo (ficam no Storage do Supabase, não nas tabelas);
- a `ENCRYPTION_KEY`: telefones, currículos extraídos e códigos continuam cifrados dentro do
  backup. Sem a mesma chave do `.env` eles não abrem. Guarde a chave no gerenciador de senhas
  junto com a senha de cifra.

**O arquivo decifrado tem dado pessoal de candidatos (LGPD).** Nunca dentro do repositório, nunca
em chat, nunca em nuvem pessoal. Os passos abaixo decifram direto para o Postgres, sem gravar o
arquivo em claro. Apague o contêiner ao terminar.

### 3.1 Baixar

```bash
gh run list --workflow backup-banco.yml --limit 5
gh run download <run-id> --dir "$HOME/cltech-backup"
```

Sai `$HOME/cltech-backup/backup-banco-<run-id>/cltech.dump.gpg`. Fora do repositório, de
propósito. No log da execução, o passo "Dump cifrado" diz a versão do Postgres
(`Servidor Postgres 17; usando postgres:17-alpine`): use a mesma versão abaixo.

### 3.2 Restaurar num banco local descartável (sempre primeiro)

Um contêiner à parte, na porta 55432, só no `127.0.0.1` (a rede não enxerga) e com senha
aleatória, para não misturar com o banco de desenvolvimento. Rode tudo no mesmo terminal, que
guarda a senha na variável `RESTORE_PW`:

```bash
RESTORE_PW=$(openssl rand -hex 16)
docker run -d --name cltech-restore -e POSTGRES_PASSWORD="$RESTORE_PW" -p 127.0.0.1:55432:5432 postgres:17-alpine
```

Espere uns segundos e restaure. O gpg pede a senha de cifra (ninguém vê o que você digita):

```bash
gpg --decrypt "$HOME/cltech-backup/backup-banco-<run-id>/cltech.dump.gpg" | docker exec -i cltech-restore pg_restore -U postgres -d postgres --no-owner --no-privileges
```

Se o gpg não conseguir abrir a janela da senha, acrescente `--pinentry-mode loopback` logo depois
de `gpg` (ele pergunta no próprio terminal). Avisos sobre o schema `public` já existir são normais.
Confira:

```bash
docker exec cltech-restore psql -U postgres -c 'select count(*) from "User";'
docker exec cltech-restore psql -U postgres -c 'select migration_name from _prisma_migrations order by finished_at desc limit 3;'
```

Para comparar com produção ou copiar linhas com outra ferramenta, conecte em
`postgresql://postgres:$RESTORE_PW@127.0.0.1:55432/postgres` (no mesmo terminal). Ao terminar:

```bash
docker rm -f cltech-restore
```

E apague a pasta `$HOME/cltech-backup` se não precisar mais dela.

### 3.3 Restaurar em produção (só com decisão explícita)

**Precisa da senha do dono do banco (`postgres`), que hoje ninguém tem.** Ela não dá para
conseguir com calma no meio da crise: redefinir a senha derruba o site até o `DATABASE_URL` da
Vercel ser trocado. Por isso a preparação está nos Passos do Davi (4.7, opcional). Sem ela, o
caminho é devolver os dados aos poucos a partir do banco local da seção 3.2.

Só depois da seção 3.2, e só se devolver dados aos poucos não resolver. Restaurar por cima
**apaga tudo o que mudou depois do backup**.

1. Rode antes um backup à mão do estado atual (mesmo estragado, é o único registro dele).
2. Faça o Instant Rollback ou deixe o site fora do ar durante a restauração.
3. Restaure com `--clean --if-exists --single-transaction --no-owner --no-privileges`, como
   `postgres`, apontando para o **session pooler** (porta 5432), com o `pg_restore` da mesma
   versão do servidor.
4. Confira com o smoke e com os contadores da seção 3.2.

## 4. Passos do Davi

Uma vez só. Nada disso vai para arquivo, chat ou log. Os dois secrets ficam só no GitHub, no
Environment `backup`.

### 4.1 Criar o papel de backup no Supabase (opção recomendada)

Supabase → **SQL Editor**. Gere antes a senha do papel no seu terminal com `openssl rand -hex 32`
(hexadecimal: não tem caractere que precise de escape na URL) e cole no lugar de `<SENHA>`:

```sql
create role backup_leitura login password '<SENHA>' bypassrls;
alter role backup_leitura set default_transaction_read_only = on;
grant usage on schema public to backup_leitura;
grant select on all tables in schema public to backup_leitura;
grant select on all sequences in schema public to backup_leitura;
-- Tabelas que as próximas migrations criarem (o dono é o postgres) já nascem legíveis.
alter default privileges for role postgres in schema public grant select on tables to backup_leitura;
alter default privileges for role postgres in schema public grant select on sequences to backup_leitura;
```

Depois:
- Confira: `select rolbypassrls from pg_roles where rolname = 'backup_leitura';` precisa dar `true`.
- **Apague essa consulta do histórico do SQL Editor** (ela tem a senha).
- Se o Supabase recusar o `bypassrls`, pare e avise: aí só sobra a opção B (ver o fim desta seção).

Por que assim: o `pg_dump` desliga o RLS na sessão. Todas as tabelas têm RLS ligado e nenhuma
política, então um papel sem `BYPASSRLS` não lê linha nenhuma, e o `pg_dump` falha (não gera dump
vazio). O que protege é a permissão: o papel só tem `SELECT` no schema `public`, nada de escrita,
e não sabe a senha do dono. O `default_transaction_read_only` é só um cinto a mais; a própria
sessão consegue desligá-lo.

### 4.2 Montar a URL do papel

Supabase → **Connect** → **Session pooler** (porta **5432**; a 6543 não serve para `pg_dump`). A
URL vem assim:

```
postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
```

Troque `postgres.<ref>` por `backup_leitura.<ref>` (o `<ref>` continua) e `[YOUR-PASSWORD]` pela
senha do passo 4.1. Monte isso de cabeça ou num bloco de notas que você fecha sem salvar. Tem que
ser o session pooler: a conexão direta do Supabase é só IPv6, e os runners do GitHub só têm IPv4.

### 4.3 Gerar e guardar a senha de cifra

```bash
openssl rand -base64 32
```

**Guarde no gerenciador de senhas ANTES de cadastrar no GitHub.** O GitHub não mostra secret
depois de salvo: sem essa senha guardada, todo backup é inútil. Guarde junto a `ENCRYPTION_KEY`
do `.env` (seção 3).

### 4.4 Criar o Environment `backup` (antes de rodar o workflow)

Os secrets ficam num Environment liberado só para a `main`: assim um workflow de outra branch não
consegue lê-los. Crie **antes** da primeira execução (se o workflow rodar sem ele, o GitHub cria
um Environment sem restrição nenhuma).

GitHub → repositório → **Settings** → **Environments** → **New environment** → nome `backup` →
**Configure environment** → em **Deployment branches and tags**, escolha **Selected branches and
tags** → **Add deployment branch or tag rule** → `main` → **Add rule**.

### 4.5 Cadastrar os dois secrets no Environment

Na pasta do repositório. O `gh` pede o valor sem mostrar na tela; cole e dê Enter:

```bash
gh secret set BACKUP_PASSPHRASE --env backup
```

```bash
gh secret set BACKUP_DATABASE_URL --env backup
```

Não cadastre como secret do repositório (sem `--env`): esse qualquer workflow enxerga.

### 4.6 Rodar uma vez à mão

Depois do merge na `main` (o botão só aparece com o workflow na branch padrão):

```bash
gh workflow run backup-banco.yml
```

```bash
gh run watch
```

Tem que terminar verde com "Backup íntegro: N tabelas" no resumo. Aproveite e faça uma vez a
seção 3.2 com esse arquivo: backup que nunca foi restaurado não está provado.

Se falhar:
- "Secret(s) ausente(s)": refaça o 4.5 (com `--env backup`).
- `password authentication failed`: senha ou usuário errados na URL (lembre do `.<ref>`). Depois
  de criar ou trocar a senha do papel, o pooler pode levar uns 15 segundos para aceitar.
- `permission denied for table`: falta o `grant select` (4.1).
- `query would be affected by row-level security policy`: o papel ficou sem `bypassrls`.
- O job nem começa, com erro de branch: rodou fora da `main` (4.4).

Lembrete: em repositório público, o GitHub desliga agendamentos depois de 60 dias sem atividade
no repositório e avisa por e-mail. Se acontecer, Actions → Backup do banco → **Enable workflow**.

**Se a senha de cifra vazar:** gere outra (4.3), troque o secret (4.5) e **apague os artifacts
antigos**, porque eles continuam abrindo com a senha antiga. Para listar e apagar:

```bash
gh api repos/daviferreira-dev/CLTech/actions/artifacts --paginate -q '.artifacts[] | select(.name | startswith("backup-banco-")) | .id'
```

```bash
gh api -X DELETE repos/daviferreira-dev/CLTech/actions/artifacts/<id>
```

Se vazar a senha do papel: `alter role backup_leitura password '<nova>';` no SQL Editor e troque o
`BACKUP_DATABASE_URL`.

### 4.7 Opcional: preparar a senha do dono para uma restauração em produção

Só é preciso para a seção 3.3. Faça num horário calmo, nunca no meio de um incidente, porque o
site cai entre o passo 2 e o passo 4:

1. Gere a senha com `openssl rand -hex 32` e guarde no gerenciador de senhas.
2. Supabase → **Database** → **Settings** → **Reset database password** → cole a senha.
3. **No mesmo momento**, Vercel → Settings → Environment Variables → `DATABASE_URL` (Production):
   troque só a senha, mantendo a porta 6543 e o `?pgbouncer=true&connection_limit=1`.
4. Deployments → ⋯ → **Redeploy** do último deploy de produção, e rode o smoke.

Essa senha não vai para o `BACKUP_DATABASE_URL`: ela apaga o banco inteiro.

### Opção B (não recomendada): a senha do dono no backup

Usar o `postgres` no `BACKUP_DATABASE_URL`. Exige o 4.7 inteiro (com a queda do site) e faz o
backup guardar uma credencial que pode apagar o banco inteiro. Só se o Supabase recusar o
`bypassrls` do passo 4.1.
