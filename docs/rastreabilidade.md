# Matriz de rastreabilidade — CLTech

**Entrega**: Sprint 3 (30/11/2026) · **Atualizada em**: 20/10/2026 · **Fonte dos requisitos**:
`docs/entregas/CLTech - ERS.docx`

Cada linha liga um requisito do ERS à especificação que o detalha, ao código que o implementa
e ao teste que o verifica. Testes de integração ficam em `tests/integration/` (Vitest) e os
end-to-end em `tests/e2e/` (Playwright, em 360 px e 1280 px).

**Legenda de status**: ✅ implementado e verificado por teste automatizado · 🟡 implementado,
verificação parcial ou dependente de infraestrutura · ❌ não implementado (motivo na linha)

---

## Requisitos funcionais

| Req. | Descrição | Spec | Implementação | Verificação | Status |
|---|---|---|---|---|---|
| RF01 | Autenticação e cadastro | 001 US1 (FR-001..FR-008) | `src/server/auth/*`, `src/app/(auth)/*`, `src/app/api/auth/*` | `auth.test.ts`, `session-orphan.test.ts`, `auth.spec.ts` | ✅ |
| RF02 | Gestão de perfil do candidato | 001 US2 (FR-009..FR-017); 003 US3; 004 | `src/server/candidates/{profile,resume,external-accounts}.ts`, `src/server/integrations/github.ts`, `src/app/(candidate)/perfil/*` | `resume-upload.test.ts`, `resume-access.test.ts`, `profile.spec.ts` | ✅ |
| RF03 | Busca e candidatura a vagas | 001 US3 (FR-018..FR-026); 002 US1; 004 US1–US2 | `src/server/jobs/{list,detail}.ts`, `src/server/applications/apply.ts`, `src/app/(public)/vagas/*` | `application-race.test.ts`, `application.spec.ts`, `job-match.spec.ts`, `error-codes.spec.ts`, `my-applications.spec.ts` | ✅ |
| RF04 | Configuração do pipeline da vaga | 002 US2 (FR-037..FR-042); 005 US1 | `src/server/jobs/builder.ts`, `src/lib/processStages.ts`, `src/app/(recruiter)/recrutamento/vagas/*` | `job-publish.test.ts`, `job-lock.test.ts`, `job-builder.spec.ts` | ✅ |
| RF05 | Aplicação de teste de código | 005 US2, US4 | `src/server/code-test/{session,challenges}.ts`, `src/app/api/me/applications/[id]/code-test/*`, `src/app/(candidate)/desafios/*` | `code-test.test.ts` (acesso, execuções, submissão única, tempo esgotado), `error-codes.spec.ts` (NOT_AVAILABLE_YET) | 🟡 código e testes prontos com sandbox falso; execução real depende da VM do Judge0 |
| RF06 | Correção automática e relatório de desempenho | 005 US3 | `src/server/code-test/{grading,report}.ts`, `src/server/sandbox/index.ts` | `code-test.test.ts` (casos ocultos, retentativa única) | 🟡 idem RF05 |
| RF07 | Painel de recrutamento multi-vaga | 002 US3 (FR-043..FR-046); 004 US4 | `src/server/jobs/dashboard.ts`, `src/app/(recruiter)/recrutamento/page.tsx` | `dashboard.spec.ts` | ✅ — métricas calculadas, não "insights de IA" (D4) |
| RF08 | Análise detalhada do candidato | 002 US4 (FR-047..FR-050); 004 US5 | `src/server/applications/{detail,decision}.ts`, `src/app/(recruiter)/recrutamento/vagas/[id]/candidaturas/*` | `evaluation-decision-immutable.test.ts`, `application-detail.spec.ts` | ✅ |
| RF09 | Busca e histórico de candidatos | 002 US5 (FR-051..FR-053); 004 US6 | `src/server/candidates/search.ts`, `src/app/(recruiter)/recrutamento/candidatos/*` | `candidate-search.spec.ts` | ✅ |

## Requisitos não funcionais

| Req. | Descrição | Spec | Implementação | Verificação | Status |
|---|---|---|---|---|---|
| RNF01 | HTTPS + AES-256 em repouso | 001 (R4); 006 US1, US3 | `src/server/crypto.ts`, `next.config.ts` (HSTS) | `lgpd-encryption.test.ts` | ✅ — cifra seletiva por campo, ver D1 |
| RNF02 | Disponibilidade 95% em horário comercial | — | Depende da hospedagem | Nenhuma ferramenta de uptime configurada | 🟡 sem monitoramento; CT-RNF02 exige um monitor externo |
| RNF03 | Consulta ≤ 3 s; correção ≤ 5 min | 001 (FR-026); 002 (FR-034) | Match pré-calculado fora do caminho de leitura (`src/server/matching/recompute.ts`); correção assíncrona (`kickGrading`) | `matching-recompute.test.ts` prova que a leitura não recalcula | 🟡 sem teste de carga com 50 usuários (CT-RNF03) |
| RNF04 | Responsivo 360–1280 px, WCAG A, carga < 2 s | 003 (todas as US); 004 | Design system `src/components/ui/*`, `src/components/layout/*` | Toda a suíte E2E roda em 360 e 1280 px | 🟡 sem auditoria Lighthouse registrada |
| RNF05 | Conformidade com a LGPD | 006 | `src/server/auth/{session,adapter}.ts`, `src/server/candidates/privacy.ts`, `src/lib/errors.ts` (log sem dado pessoal) | `lgpd-encryption.test.ts`, `lgpd-access.test.ts`, `lgpd-rights.test.ts`, `resume-access.test.ts` | ✅ — os três passos do CT-RNF05 automatizados |
| RNF06 | Sandbox isolado, sem rede, ≤ 10 s | 005 (FR-208); R10 | `src/server/sandbox/index.ts` (Judge0, `enable_network: false`, limites de CPU e tempo) | `code-test.test.ts` com sandbox falso | 🟡 VM Oracle Cloud ainda não provisionada; sem ela a execução responde `SANDBOX_UNAVAILABLE` |

## Regras de negócio

| Regra | Descrição | Implementação | Verificação | Status |
|---|---|---|---|---|
| RN001 | Toda triagem passa pela IA antes do RH | `applyToJob` grava `Evaluation(RESUME_MATCH)` na mesma transação (`src/server/applications/apply.ts`, `src/server/matching/score.ts`) | `evaluation-on-apply.test.ts`, `matching-score.test.ts` | ✅ — motor roda dentro do Next.js, sem LLM (D11) |
| RN002 | Vaga só publica com stack e requisitos | `publishJob` em `src/server/jobs/builder.ts` | `job-publish.test.ts` | ✅ |
| RN003 | Score da IA imutável | Trigger `evaluation_immutable` (migração `20260912000001`); rota de decisão sem campo de score | `evaluation-immutable.test.ts`, `evaluation-decision-immutable.test.ts` | ✅ |
| RN004 | Dados sensíveis só para Recrutador/Admin | `requireRole` relê o papel no banco a cada acesso; `requirePageRole` nas páginas | `lgpd-access.test.ts` (matriz de rotas), `resume-access.test.ts`, `session-orphan.test.ts` | ✅ |
| RN005 | Feedback obrigatório por e-mail | — | — | ❌ adiada na Sprint 3 (decisão registrada em `specs/ORDEM-EXECUCAO.md`) |
| RN006 | Tentativa única no teste de código | `@@unique([applicationId, challengeId])` em `CodeSubmission` | `code-test.test.ts` ("submissão única") | ✅ |
| RN007 | Um perfil por e-mail | `User.email @unique`, e-mail normalizado em minúsculas | `auth.test.ts` (e-mail duplicado, normalização) | ✅ |

## Casos de teste de RNF do ERS

| Caso | Como executar | Situação |
|---|---|---|
| CT-RNF01 | `pnpm test -- lgpd-encryption`; inspecionar o certificado no navegador | Automatizado (cifra) + manual (HTTPS no deploy) |
| CT-RNF02 | Monitor de uptime externo no horário comercial | Não executado — falta o monitor |
| CT-RNF03 | Ferramenta de carga (ex.: k6) com 50 usuários em `/vagas` e `/recrutamento` | Não executado |
| CT-RNF04 | `pnpm test:e2e` (360/1280 px) + Lighthouse na home | E2E automatizado; Lighthouse pendente |
| CT-RNF05 | `pnpm test -- lgpd` | Automatizado (três passos) |
| CT-RNF06 | Submeter código que abre conexão de rede e laço infinito, com a VM ativa | Bloqueado pela VM do Judge0 |

---

## Pendências que mudam esta matriz

1. Provisionar a VM do Judge0 e preencher `SANDBOX_URL`: RF05, RF06 e RNF06 passam a ✅
   depois de rodar o CT-RNF06.
2. RN005: decidir se entra antes de 30/11.
3. CT-RNF02, CT-RNF03 e o Lighthouse do CT-RNF04: precisam do deploy final para serem medidos.
4. Divergências do ERS ainda por emendar no `.docx`: ver a tabela "Resumo das ações" em
   `specs/001-portal-candidatura/ers-divergences.md`.
