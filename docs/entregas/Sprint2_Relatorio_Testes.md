# Relatório de testes — Sprint 2

**Data da execução:** 24/10/2026 · **Commit base:** `1e27fc5` + correções desta rodada
**Ambiente:** Windows 11, Node 24, banco PostgreSQL (Supabase), build de produção (`next build && next start`)

## Resultado

| Suíte | Comando | Resultado |
|---|---|---|
| Integração + unidade (Vitest) | `pnpm test` | **137 de 137 passaram** (19 arquivos, 118 s) |
| Ponta a ponta (Playwright) | `pnpm test:e2e` | **58 de 58 passaram** (29 cenários × 2 telas: 1280 px e 360 px, 2,2 min) |

## Integração e unidade — o que cada arquivo prova

| Arquivo | Testes | Cobre |
|---|---|---|
| `evaluation-on-apply.test.ts` | 4 | Nenhuma candidatura sem avaliação automática (RN001) |
| `evaluation-immutable.test.ts` | 2 | `UPDATE` em Evaluation falha no banco (RN003) |
| `evaluation-decision-immutable.test.ts` | 3 | Decisão do recrutador não altera o score (RN003) |
| `matching-score.test.ts` | 7 | Cálculo do score de compatibilidade (triagem) |
| `matching-recompute.test.ts` | 5 | Recálculo da compatibilidade nos gatilhos |
| `job-publish.test.ts` | 6 | Vaga só publica com tecnologias, requisitos e etapas (RN002) |
| `job-lock.test.ts` | 5 | Vaga publicada recusa mudar stack e pipeline |
| `application-race.test.ts` | 3 | Candidatura duplicada simultânea é barrada pelo índice único |
| `code-test.test.ts` | 18 | Teste de código: prazo, autosave cifrado, limite de execuções, tentativa única, correção (RF05/RF06) |
| `auth.test.ts` | 7 | Cadastro, hash de senha, e-mail duplicado, destino por papel, 1º login OAuth |
| `session-orphan.test.ts` | 6 | Sessão de usuário apagado devolve 401 |
| `lgpd-access.test.ts` | 26 | Matriz de acesso: toda rota de recrutador e do titular nega quem não pode (RN004) |
| `lgpd-encryption.test.ts` | 9 | Dados sensíveis cifrados em repouso (AES-256-GCM) |
| `lgpd-rights.test.ts` | 5 | Exportação de dados e exclusão de conta |
| `resume-upload.test.ts` | 3 | Upload de currículo: formato, tamanho, histórico |
| `resume-access.test.ts` | 4 | Currículo só por URL assinada e com papel autorizado |
| `profile-details.test.ts` | 6 | Perfil profissional (experiência, formação, idiomas) |
| `unit/resume-parse.test.ts` | 13 | Leitura estruturada do currículo |
| `unit/profile-form.test.ts` | 7 | Validação do formulário de perfil |

## Ponta a ponta — cenários

| Arquivo | Cenários | Cobre |
|---|---|---|
| `auth.spec.ts` | 4 | Cadastro, senha errada, destino do recrutador, sessão persistente (RF01) |
| `profile.spec.ts` | 2 | Perfil persiste; PDF aceito e `.txt` recusado (RF02) |
| `application.spec.ts` | 4 | Vagas sem login, filtro, candidatura deslogado, sem currículo (RF03) |
| `job-match.spec.ts` | 3 | Percentual de compatibilidade e quando ele aparece |
| `my-applications.spec.ts` | 2 | Minhas candidaturas e estado vazio |
| `job-builder.spec.ts` | 1 | Criar vaga, montar pipeline, publicar e travar (RF04) |
| `dashboard.spec.ts` | 1 | Painel com contagem por etapa e filtro por vaga (RF07) |
| `application-detail.spec.ts` | 1 | Relatório do candidato e avanço de etapa (RF08) |
| `candidate-search.spec.ts` | 2 | Busca de candidatos e histórico agrupado (RF09) |
| `error-codes.spec.ts` | 9 | Cada código de erro da API vira uma mensagem e um próximo passo na tela |

## Problemas encontrados e corrigidos nesta rodada

| Problema | Correção |
|---|---|
| Primeiro login com GitHub criava o usuário sem perfil de candidato: `/perfil` e a candidatura davam "Perfil não encontrado" | Perfil criado junto com o usuário em `src/server/auth/adapter.ts`, com teste novo em `auth.test.ts` |
| `lgpd-access.test.ts` falhava (25 testes) quando o projeto fica numa pasta com espaço no nome | Rotas importadas pelo alias `@/` em vez de `file://` |
| `profile.spec.ts`: o seletor "Cidade" também casava com "Priva**cidade**" | Seletor exato |
| Senha do banco em `.env.test.example` desatualizada | Testes rodados com o `DATABASE_URL` do `.env`; atualizar o arquivo é decisão da equipe |

## Limitações conhecidas

- A execução real do código do candidato depende da VM com Judge0 (`SANDBOX_URL`), prevista na Sprint 3.
  Os testes de código usam um sandbox simulado; a tela trata a indisponibilidade como "correção em andamento".
- `pnpm test` limpa as tabelas do banco compartilhado. Rodar `pnpm db:seed` depois.

## Evidências

- Relatório HTML do Playwright: `playwright-report/index.html` (gerado por `pnpm test:e2e`, abrir com `pnpm exec playwright show-report`)
