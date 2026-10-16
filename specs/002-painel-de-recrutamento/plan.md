# Implementation Plan: Painel de Recrutamento e Triagem Automática (Sprint 2)

**Branch**: `002-painel-de-recrutamento` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-painel-de-recrutamento/spec.md`

## Summary

O recrutador passa a criar vagas de verdade e montar o pipeline de seleção (RF04); o
candidato passa a ver, em cada vaga publicada, o percentual de compatibilidade do próprio
perfil (débito da FR-026 da Sprint 1); e o recrutador ganha um painel consolidado (RF07),
consegue abrir o relatório completo de um candidato dentro de uma candidatura para decidir
avançar/reprovar (RF08), e buscar candidatos já conhecidos entre todas as vagas (RF09).

A abordagem técnica mantém a aplicação Next.js única da Sprint 1 — o motor de triagem
(cálculo de compatibilidade) é implementado **inline, em TypeScript**, não como o serviço
Python/FastAPI que `services/ai/README.md` previa desde a Sprint 1. É um algoritmo
determinístico (sobreposição de tecnologias exigidas vs. texto do currículo + linguagens do
GitHub), nunca um LLM — decisão registrada em
[D11](../001-portal-candidatura/ers-divergences.md#d11). `services/ai/` segue reservado para
a correção de código da Sprint 3.

O teste de código em si (RF05/RF06, RNF06) continua fora desta entrega.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS — sem mudança em relação à Sprint 1.
`services/ai` (Python) segue reservado, sem código novo nesta sprint.

**Primary Dependencies**: as da Sprint 1 (Next.js 15, React 19, Auth.js, Prisma 6, Zod,
Tailwind), mais dois extratores de texto server-side para o motor de triagem:
`pdf-parse` (PDF) e `mammoth` (DOCX). Nenhuma dependência de IA/LLM.

**Storage**: mesmo PostgreSQL 16 via Prisma e bucket S3-compatível da Sprint 1. Uma coluna
nova, `Resume.extractedText` (cifrada AES-256-GCM, mesmo padrão de `Candidate.phone` e do
arquivo original — R4 da Sprint 1), guarda o texto extraído para reuso no cálculo de
compatibilidade sem reabrir o arquivo a cada recálculo.

**Testing**: Vitest (unidade + integração, mesmo banco de teste da Sprint 1) e Playwright
(E2E + responsividade 360/1280 px), seguindo o mesmo padrão.

**Target Platform**: idêntico à Sprint 1 — navegadores modernos, deploy serverless. O motor
de triagem sendo inline (não um novo serviço) significa **nenhuma mudança de infraestrutura
de deploy** nesta sprint.

**Project Type**: mesma aplicação web full-stack em monorepo da Sprint 1.

**Performance Goals**: painel e listagem de vagas com compatibilidade utilizáveis em ≤ 3 s
com 50 usuários simultâneos (RNF03/SC-013) — exige que as métricas do painel (FR-045) e o
match da listagem (FR-033) sejam lidos de dados pré-agregados/pré-calculados, nunca
computados no caminho da requisição (mesma restrição que já valeu para `JobMatch` desde o
[D3](../001-portal-candidatura/ers-divergences.md#d3) da Sprint 1).

**Constraints**: as da Sprint 1 (LGPD, 100% navegador, responsivo 360-1280 px, orçamento
≈ R$ 0/mês) mais: score e avaliação continuam somente-leitura e versionados (RN003, trigger
de banco já existente desde T008/Sprint 1) — nenhuma rota nova pode expor update sobre
`Evaluation` ou `JobMatch`.

**Scale/Scope**: mesmo protótipo acadêmico. Nesta sprint: 1 coluna nova no schema
(`Resume.extractedText`), ~12 rotas de API novas, ~6 telas novas/substituídas
(builder de vaga, painel, detalhe do candidato, busca de candidatos; listagem e detalhe de
vaga existentes ganham o percentual de compatibilidade).

## Constitution Check

*GATE: avaliado antes da Phase 0 e reavaliado após a Phase 1.*

| Princípio | Aplica-se nesta sprint? | Como o plano atende | Veredito |
|---|---|---|---|
| **I. Privacidade e LGPD por Padrão** (não-negociável) | Sim | `Resume.extractedText` cifrado no mesmo padrão do arquivo (R4); nenhum dado de candidato sai da infraestrutura — motor de triagem roda dentro do próprio processo Next.js, sem chamada a LLM externo (D11); rotas de painel/detalhe/busca exigem papel Recrutador/Administrador verificado no servidor (FR-047, FR-051, reforço de FR-017). | ✅ Passa |
| **II. Score Objetivo e Imutável** (não-negociável) | Sim — primeira sprint em que `Evaluation` e `JobMatch` são preenchidos de fato | Nenhuma rota de update é criada para `Evaluation`/`JobMatch`; reprocessamento é sempre `INSERT`/`UPSERT` de um novo registro, nunca `UPDATE` do score (a trigger `BEFORE UPDATE` de `Evaluation` já bloqueia isso desde T008). FR-050 proíbe explicitamente qualquer interface de edição de score. | ✅ Passa |
| **III. Triagem Sempre Mediada por IA** | Sim — primeira sprint com painel do recrutador | FR-037 garante que toda candidatura, no momento em que é criada, já tem uma `Evaluation` com score e justificativa — o recrutador nunca vê uma "lista crua". Enquanto a extração de currículo falha (edge case de PDF ilegível), o score usa o sinal disponível em vez de bloquear, mas a avaliação ainda existe e é marcada como baseada em sinal parcial. | ✅ Passa |
| **IV. Isolamento Total na Execução de Código de Terceiros** (não-negociável) | Não — teste de código é Sprint 3 | A etapa `CODE_TEST` pode ser configurada no pipeline (FR-039) mas não executa nada; o relatório do candidato mostra "ainda não disponível" (FR-048). Nenhuma rota de execução de código existe. | ✅ N/A nesta sprint |
| **V. Acesso Exclusivo via Navegador** | Sim | Todas as telas novas são web; nenhuma ferramenta local é introduzida. Playwright valida 360/1280 px (FR-054). | ✅ Passa |
| **VI. Simplicidade Orçamentária e Manutenibilidade** | Sim | Motor de triagem inline em vez do serviço Python separado (D11) elimina um runtime, um alvo de deploy e uma chamada de rede — zero custo adicional, zero infraestrutura nova. `pdf-parse`/`mammoth` são bibliotecas locais, sem custo recorrente. | ✅ Passa |

**Restrições técnicas da constituição**: aplicação única Next.js mantida ✅ · nenhuma
listagem de candidato sem triagem prévia ✅ (FR-037) · score imutável ✅ (trigger já
existente) · segredos em variáveis de ambiente ✅ (nenhuma chave de LLM é necessária).

**Gate pós-Phase 1**: a reavaliar após `data-model.md` e `contracts/api.md` desta sprint
(ainda não escritos — próximo passo depois deste plano).

## Project Structure

### Documentation (this feature)

```text
specs/002-painel-de-recrutamento/
├── plan.md              # Este arquivo
├── spec.md              # Requisitos (sem detalhe técnico)
├── research.md          # Phase 0 — decisões técnicas (a escrever)
├── data-model.md         # Phase 1 — coluna nova + transições de estado de Job/ProcessStage
├── quickstart.md         # Phase 1 — roteiro de validação dos 5 fluxos
├── contracts/
│   └── api.md            # Phase 1 — contratos HTTP novos
└── tasks.md               # Phase 2 — lista de tarefas

specs/001-portal-candidatura/
└── ers-divergences.md     # D11 (novo) e D3 (resolvido) vivem aqui — é o registro único
                            # de divergências do projeto, não duplicado por sprint
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                       # + Resume.extractedText
└── migrations/                         # nova migração aditiva, não destrutiva

src/
├── app/
│   ├── (public)/
│   │   ├── vagas/page.tsx              # + percentual de compatibilidade (FR-033..036)
│   │   └── vagas/[id]/page.tsx         # + tecnologias encontradas/faltantes (FR-033)
│   ├── (recruiter)/
│   │   └── recrutamento/
│   │       ├── page.tsx                # painel (RF07) — substitui o placeholder da Sprint 1
│   │       ├── vagas/
│   │       │   ├── page.tsx            # lista de vagas do recrutador (rascunho/publicada)
│   │       │   ├── nova/page.tsx       # criar vaga + builder de pipeline (RF04)
│   │       │   └── [id]/
│   │       │       ├── page.tsx        # editar rascunho / ver publicada (read-only)
│   │       │       └── candidaturas/[applicationId]/page.tsx  # relatório do candidato (RF08)
│   │       └── candidatos/page.tsx     # busca e histórico (RF09)
│   └── api/
│       ├── jobs/route.ts               # GET — + matchScore quando autenticado
│       ├── jobs/[id]/route.ts          # GET — + tecnologias encontradas/faltantes
│       └── recruiter/
│           ├── jobs/route.ts           # POST — criar vaga (rascunho)
│           ├── jobs/[id]/route.ts      # PATCH — editar rascunho
│           ├── jobs/[id]/stages/route.ts    # PUT — definir/reordenar etapas
│           ├── jobs/[id]/publish/route.ts   # POST — publicar (RN002)
│           ├── dashboard/route.ts      # GET — métricas do painel (FR-043..046)
│           ├── applications/[id]/route.ts            # GET — relatório do candidato
│           ├── applications/[id]/decision/route.ts   # POST — avançar/reprovar
│           └── candidates/route.ts     # GET — busca (FR-051..053)
├── server/
│   ├── matching/
│   │   ├── text-extract.ts             # extrai texto de PDF/DOCX (pdf-parse/mammoth)
│   │   ├── score.ts                    # função pura: compatibilidade determinística
│   │   └── recompute.ts                # recalcula JobMatch de um candidato (FR-034)
│   ├── jobs/
│   │   ├── builder.ts                  # criar/editar rascunho, validar e publicar (RN002)
│   │   ├── dashboard.ts                 # agregações do painel (FR-043..046)
│   │   └── list.ts, detail.ts           # (Sprint 1) + injeção de matchScore
│   ├── applications/
│   │   ├── detail.ts                    # relatório do candidato (FR-047)
│   │   └── decision.ts                  # avançar/reprovar (FR-049), grava Evaluation
│   └── candidates/
│       └── search.ts                    # busca + agrupamento por candidato (FR-051..052)
└── components/                          # UI do builder (lista ordenável), painel, relatório

tests/
├── integration/
│   ├── matching.test.ts                 # score determinístico, extração de texto
│   ├── job-publish.test.ts              # RN002 bloqueia publicação incompleta
│   ├── job-lock.test.ts                 # vaga publicada não aceita edição de pipeline/stack
│   ├── evaluation-immutable.test.ts     # (Sprint 1) segue valendo, agora com dado real
│   └── candidate-search.test.ts         # agrupamento por e-mail (RF09)
└── e2e/
    ├── job-builder.spec.ts              # Fluxo 1 do quickstart.md desta sprint
    ├── dashboard.spec.ts
    ├── application-detail.spec.ts
    └── candidate-search.spec.ts
```

**Structure Decision**: mesma aplicação Next.js única da Sprint 1, sem novo serviço. A
separação `src/app/api/` (casca HTTP) / `src/server/` (regra de negócio) se mantém — o
motor de triagem (`src/server/matching/`) é só mais um módulo de domínio, testável sem HTTP
e sem rede, o que o torna barato de extrair para `services/ai/` depois, se um motivo técnico
real aparecer (D11).

## Complexity Tracking

> Preenchido apenas se o Constitution Check apontar violações a justificar.

Nenhuma violação. Tabela intencionalmente vazia.
