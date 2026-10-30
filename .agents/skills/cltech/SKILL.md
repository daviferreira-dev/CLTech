---
name: cltech
description: Regras do projeto CLTech (portal de recrutamento em Next.js 15 + Prisma + Postgres). Use ao escrever, testar ou revisar qualquer código, migration, tela ou documentação deste repositório.
---

# CLTech

Portal de recrutamento técnico. Candidato se inscreve e faz teste de código; recrutador/admin
monta vagas e pipelines e decide. Produção na Vercel, banco e storage no Supabase.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 3. Node 24 (`engines`), pnpm 10.
- Prisma 6 + PostgreSQL 16. Schema em `prisma/schema.prisma`, config em `prisma.config.ts`.
- Auth.js (`next-auth` v5 beta) com adapter próprio em `src/server/auth/adapter.ts`; senhas com Argon2.
- Vitest (projetos `unit` e `integration`, `vitest.workspace.ts`) e Playwright (`tests/e2e`).
- Papéis: `CANDIDATE`, `RECRUITER`, `ADMIN` (enum `UserRole`).

## Onde fica cada coisa

- `src/app/api/`: casca HTTP fina. A regra de negócio vai em `src/server/`, testável sem HTTP.
- `src/lib/`: utilitários compartilhados. `src/components/`: UI.
- `specs/NNN-*/`: spec, plano e tarefas de cada feature. Contratos de API em
  `specs/002-painel-de-recrutamento/contracts/api.md`.

## Comandos

```bash
pnpm dev:setup          # Postgres no Docker, .env local, migrações e seed (idempotente)
pnpm dev                # next dev --turbopack
pnpm lint
pnpm exec tsc --noEmit
pnpm test:unit          # sem banco
pnpm test:integration   # banco cltech_test (TRUNCATE antes de cada teste)
pnpm test               # unit + integration
pnpm test:e2e           # Playwright, sobe pnpm build && pnpm start
pnpm prisma:migrate     # prisma migrate dev
pnpm db:seed
```

## Regras inegociáveis

1. **Nunca aponte o `.env` para produção (Supabase).** Desenvolva com `pnpm dev:setup`
   (`postgresql://cltech:cltech@localhost:5432/cltech`). Os testes de integração apagam o banco;
   rodar contra o Supabase destrói dados reais.
2. **Nunca commite `.env`**, `.env.test`, `.env.backup` nem segredo algum. Valores novos vão
   documentados, vazios, em `.env.example`.
3. **Dependências:** respeite o `minimumReleaseAge` do pnpm (não instalar versão publicada há
   menos tempo que o prazo; não contornar com `minimumReleaseAgeExclude` sem motivo escrito).
   Hoje o `pnpm-workspace.yaml` não define o valor; se definir, siga-o. Builds nativos só pelos
   pacotes listados em `allowBuilds`. Use `pnpm install --frozen-lockfile` no CI.
4. **Antes do PR**, o mesmo que o CI (`.github/workflows/ci.yml`) roda: `pnpm lint`,
   `pnpm exec tsc --noEmit`, `pnpm test` e `pnpm build`. Mexeu em tela ou fluxo: `pnpm test:e2e`.
5. **Erros de API** usam `src/lib/errors.ts`: lance `Errors.*` (ou `new ApiError(status, code,
   message)`) e responda com `toErrorResponse(err)` no `catch` da rota. Formato único
   `{ "error": { "code", "message" } }`. Nunca `console.error(err)` com objeto do Prisma: use
   `logSafeError`, que descarta a mensagem (pode conter dado pessoal).
6. **Visual:** `DESIGN.md` é a fonte de cores, tipografia e componentes. Não invente cor nem
   fonte fora dele.
7. **LGPD:**
   - dado pessoal sensível é cifrado com `encrypt`/`decrypt` de `src/server/crypto.ts`
     (AES-256-GCM, chave `ENCRYPTION_KEY`); e-mail fica em claro por ser identidade (RN007);
   - currículos ficam cifrados em bucket privado e só saem pelo servidor, para quem tem papel (RN004);
   - **não guarde tokens OAuth**: o adapter descarta `access_token`, `refresh_token` e `id_token`
     (`stripOAuthTokens`); não reverta isso;
   - nada de dado pessoal em log, URL ou query string.
8. **Score de compatibilidade é imutável** (RN003): nenhuma rota edita um score emitido; há
   trigger no banco. Correção só por reprocessamento, que cria nova versão.
9. Código de candidato roda no sandbox (`src/server/sandbox`). `SANDBOX_URL="local"` executa sem
   isolamento e é só para dev.
