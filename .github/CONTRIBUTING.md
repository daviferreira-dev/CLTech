# Como contribuir

## Fluxo

1. Atualize a `main` e crie uma branch: `feat/nome-curto`, `fix/nome-curto` ou `docs/nome-curto`.
2. Faça commits pequenos no padrão abaixo.
3. Rode os testes e abra um PR para a `main` preenchendo o template.
4. O CI precisa passar antes do merge.

## Commits

```
tipo(escopo): descrição curta no imperativo
```

`tipo`: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. O escopo é opcional.
Exemplos do histórico: `feat(sandbox): suporte ao Judge0 hospedado no RapidAPI`,
`fix(curriculo): corrige upload de currículo na Vercel`.

## Ambiente e testes

```bash
pnpm install
pnpm dev:setup          # Postgres no Docker, migrações e seed
pnpm lint
pnpm exec tsc --noEmit
pnpm test               # unit + integration (banco cltech_test)
pnpm test:e2e           # Playwright, se mexeu em tela ou fluxo
```

Detalhes no [README](../README.md#como-rodar-localmente) e em
[docs/manual-execucao.md](../docs/manual-execucao.md).

## O que o CI confere

Em todo PR e push na `main` ([`ci.yml`](workflows/ci.yml)), dois jobs em paralelo:

**`check`**
- Nenhum `.env`, `.env.*` (fora os `.example`) nem `.playwright-mcp/` versionado.
- `pnpm lint` e `pnpm exec tsc --noEmit`.
- `schema.prisma` bate com as migrations (`prisma migrate diff --exit-code`). Mudou o schema?
  Rode `pnpm prisma:migrate` e commite a migration.
- Só em PR: toda migration **nova** com `CREATE TABLE` tem o
  `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;` da mesma tabela
  ([`scripts/check-migration-rls.ts`](../scripts/check-migration-rls.ts)). Local:
  `node scripts/check-migration-rls.ts origin/main` (compara commits: migration ainda não
  commitada não entra).
- `prisma migrate deploy`, `pnpm test` (unit + integration) e `pnpm build`.

**`e2e`**
- Playwright (Chromium, 1280 px e 360 px) contra `pnpm build && pnpm start`, com Postgres,
  seed e Mailpit do próprio runner e variáveis falsas. Nada sai do runner.
- Se falhar, o relatório e os traces ficam no artifact `playwright-report` da execução
  (Actions → a execução → Artifacts). Abra com `pnpm exec playwright show-report <pasta>`.

Depois do deploy de produção, [`smoke-producao.yml`](workflows/smoke-producao.yml) confere com
`curl` em `https://cltech-3aq.vercel.app` que `/`, `/entrar` e `/vagas` dão 200, `/perfil` dá 307
(manda para o login) e `GET /api/recruiter/dashboard` dá 401. Cada rota tenta até 5 vezes, porque
o domínio pode demorar uns segundos para apontar para o deploy novo. O gatilho é o commit status
`Vercel` com `success` num commit da `main` (a Vercel não cria GitHub Deployments aqui). Dá para
rodar à mão em Actions → Smoke de produção → Run workflow.

## Regras

- Nunca commite `.env` nem aponte o `.env` local para o banco de produção.
- Dado pessoal novo é cifrado (`src/server/crypto.ts`) e restrito por papel.
- Toda tabela nova liga RLS na própria migration (`ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;`).
- O score de compatibilidade é imutável depois de emitido (RN003).
- Visual segue o [DESIGN.md](../DESIGN.md).
