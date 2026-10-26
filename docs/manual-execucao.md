# Manual de execução — CLTech

Como instalar, configurar, rodar, demonstrar e testar a plataforma. Escrito para quem vai
avaliar ou apresentar o projeto sem ter participado do desenvolvimento.

Para o que cada requisito faz e onde está, ver a [matriz de rastreabilidade](./rastreabilidade.md).

---

## 1. Pré-requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js | 20 LTS ou superior | testado também no 24 |
| pnpm | 9.x | sem pnpm instalado, `npx pnpm@9 <comando>` funciona igual |
| Git | qualquer recente | |
| Projeto Supabase | — | banco Postgres e bucket S3-compatível para os currículos |

Não é preciso Docker nem Python. O motor de triagem roda dentro da própria aplicação
Next.js (divergência D11 do ERS). A pasta `services/ai/` está reservada e não é usada.

## 2. Instalação

```bash
git clone <url-do-repositorio>
cd CLTech
pnpm install            # demora alguns minutos na primeira vez
pnpm prisma generate    # obrigatório: o projeto não tem postinstall
```

No Windows, `run.bat` faz instalação, confere o `.env` (gera `AUTH_SECRET` e `ENCRYPTION_KEY` se
estiverem vazias e para listando o que falta), gera o Prisma, aplica migrações e seed, faz build e start.

## 3. Configuração

Copie `.env.example` para `.env` e preencha:

| Variável | Obrigatória | Como obter |
|---|---|---|
| `DATABASE_URL` | sim | Supabase → Project Settings → Database → *Connection pooling* (porta 5432) |
| `AUTH_SECRET` | sim | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | sim | `openssl rand -base64 32`. **Perder esta chave torna irrecuperáveis os telefones, currículos e códigos já gravados.** |
| `GITHUB_ID` / `GITHUB_SECRET` | sim | github.com/settings/developers; callback `http://localhost:3000/api/auth/callback/github` |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | sim | Supabase → Storage → *S3 Connection*. O bucket **precisa ser privado**. |
| `NEXTAUTH_URL` | sim | `http://localhost:3000` local; a URL pública em produção |
| `LINKEDIN_ID` / `LINKEDIN_SECRET` | não | vazio esconde o botão do LinkedIn |
| `SANDBOX_URL` / `SANDBOX_TOKEN` | não | URL da VM com Judge0. Vazio: "Executar testes" e "Submeter" respondem que o ambiente está indisponível (o rascunho fica salvo). Submissão que falhou na correção é retentada a cada consulta, no máximo a cada 5 minutos, quando o sandbox volta. `local` (só dev): roda python/javascript/typescript direto na máquina, sem isolamento; ignorado com `NODE_ENV=production`, salvo `SANDBOX_ALLOW_LOCAL=1` (o `run.bat` já define) |
| `CRON_SECRET` | não | protege `POST /api/internal/code-tests/expire`. Vazio desliga a rota |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | não | e-mail ao candidato quando ele passa de etapa, é aprovado ou reprovado (RN005). Gmail: `smtp.gmail.com`, porta 587 e uma *senha de app* (myaccount.google.com/apppasswords). Vazio desliga o envio |

## 4. Banco de dados

```bash
pnpm prisma migrate deploy   # aplica as migrações (inclui a trigger que torna o score imutável)
pnpm db:seed                 # usuários, 5 vagas publicadas, 2 desafios e uma vaga encerrada
```

O seed pode ser rodado de novo sem duplicar nada.

**Apenas em bancos criados antes da spec 006**: rodar uma vez
`prisma/scripts/006-limpa-tokens-oauth.sql` no SQL Editor do Supabase. Ele apaga os tokens
OAuth que versões antigas guardavam sem necessidade.

## 5. Rodar a aplicação

```bash
pnpm build && pnpm start     # http://localhost:3000
```

Use build + start, não `pnpm dev`. No modo dev, a primeira abertura de cada tela compila sob
demanda e fica lenta o bastante para atrapalhar uma demonstração.

### Contas de demonstração (criadas pelo seed)

| Papel | E-mail | Senha |
|---|---|---|
| Recrutador | `recrutador@3aq.dev` | `Senha123!` |
| Administrador | `admin@3aq.dev` | `Senha123!` |
| Candidato | `candidato.demo@example.com` | `Senha123!` |

Só o administrador cria e edita desafios do catálogo. O recrutador apenas os escolhe para
as vagas.

## 6. Roteiro de demonstração (≈ 10 min)

Use duas janelas: uma normal para o candidato e uma anônima para o recrutador.

1. **Visitante**: abra `/vagas` sem login. A listagem é pública e os filtros vão para a
   URL. Não aparece percentual de compatibilidade.
2. **Cadastro (RF01)**: "Criar conta" leva a `/vagas`. Tente se candidatar ainda sem
   currículo: a tela pede para completar o perfil.
3. **Perfil (RF02)**: em `/perfil`, preencha o telefone e envie um PDF. Conectar o GitHub é
   opcional. Ao voltar a `/vagas`, o percentual de compatibilidade aparece.
4. **Candidatura (RF03, RN001)**: candidate-se a "Desenvolvedor(a) Backend Node.js Júnior".
   A triagem automática roda na hora. Em `/candidaturas` aparece a etapa atual.
5. **Recrutador (RF07)**: entre como `recrutador@3aq.dev`. O painel mostra a contagem de
   candidaturas por etapa.
6. **Relatório (RF08, RN003)**: abra a candidatura nova. Ela traz score, currículo e
   GitHub, e não há campo para editar a nota. Avance a candidatura até a etapa de teste de
   código.
7. **Teste de código (RF05, RF06, RN006)**: como candidato, abra "Desafios Técnicos",
   escreva a solução, use "Executar testes" e envie. O reenvio fica bloqueado. **Requer
   `SANDBOX_URL`**: sem a VM, a execução avisa que o ambiente está indisponível.
8. **Busca (RF09)**: como recrutador, busque o e-mail do candidato em "Candidatos".
9. **Pipeline (RF04, RN002)**: crie uma vaga e tente publicá-la sem tecnologias. A
   publicação é recusada. Complete os campos, publique, e veja que tecnologias e etapas
   ficam travadas.
10. **LGPD (RNF05)**: o rodapé leva ao aviso de privacidade. Em `/perfil`, use "Baixar meus
    dados" e depois "Excluir minha conta" (digite `EXCLUIR`). A sessão termina e a home
    confirma a exclusão.

## 7. Testes automatizados

```bash
pnpm lint
pnpm test                    # Vitest — integração
pnpm db:seed                 # obrigatório entre os dois — ver aviso
pnpm exec playwright install chromium   # só na primeira vez
pnpm test:e2e                # Playwright — 360 px e 1280 px, sobe build + start sozinho
```

> **`pnpm test` apaga o banco.** Os testes de integração leem o `DATABASE_URL` de
> `.env.test.example` e dão `TRUNCATE` em todas as tabelas antes de cada teste. Hoje esse
> arquivo aponta para o mesmo projeto Supabase de desenvolvimento, então rodar a suíte apaga
> o seed. Rode `pnpm db:seed` antes do E2E e antes de qualquer demonstração.

Para rodar só a auditoria LGPD (CT-RNF05): `pnpm test -- lgpd`.

## 8. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `Can't reach database server` | Projeto Supabase pausado por inatividade (plano gratuito) ou rede bloqueando a porta | Restaurar o projeto no painel do Supabase; testar de outra rede |
| `/vagas` vazia | `pnpm test` rodou depois do seed | `pnpm db:seed` |
| `ENCRYPTION_KEY não configurada` / erro ao abrir o perfil | Chave ausente ou diferente da usada para gravar | Usar a mesma chave do ambiente que gravou os dados |
| "Ambiente de execução indisponível" no desafio | `SANDBOX_URL` vazio ou VM fora do ar | Comportamento esperado sem a VM. O código do candidato fica salvo |
| Desafio com prazo vencido não é submetido sozinho | Ninguém agendou a rota de expiração | Agendar `POST /api/internal/code-tests/expire` com `Authorization: Bearer $CRON_SECRET`. Sem isso, a expiração só acontece quando o candidato volta à tela |
