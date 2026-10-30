## Resumo

<!-- O que muda e por quê. Linke a issue ou a spec (ex. specs/005-teste-tecnico). -->

## Tipo

- [ ] `feat`: funcionalidade nova
- [ ] `fix`: correção de bug
- [ ] `docs`: só documentação
- [ ] `refactor` / `chore` / `test`

## Testes

- [ ] `pnpm lint`
- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm test` (unit + integration)
- [ ] `pnpm test:e2e`, se mexeu em tela ou fluxo
- [ ] Testado em 360 px e 1280 px, se mexeu em tela

## Banco

- [ ] Sem migration
- [ ] Com migration (`prisma/migrations/...`), aplicada com `pnpm prisma:migrate` e reversível ou segura em produção

## Checklist

- [ ] Nenhum segredo, `.env` ou dado real de candidato no diff
- [ ] Dado pessoal novo é cifrado e restrito por papel
- [ ] Erros de API usam `src/lib/errors.ts`
- [ ] Visual segue o `DESIGN.md`
