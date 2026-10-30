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

## Regras

- Nunca commite `.env` nem aponte o `.env` local para o banco de produção.
- Dado pessoal novo é cifrado (`src/server/crypto.ts`) e restrito por papel.
- O score de compatibilidade é imutável depois de emitido (RN003).
- Visual segue o [DESIGN.md](../DESIGN.md).
