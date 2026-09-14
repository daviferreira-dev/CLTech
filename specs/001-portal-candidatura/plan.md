# Implementation Plan: Portal de Candidatura (Sprint 1)

**Branch**: `001-portal-candidatura` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-portal-candidatura/spec.md`

## Summary

Entregar a fundação web da CLTech: uma pessoa cria conta (e-mail/senha ou GitHub),
monta o perfil com currículo e portfólio do GitHub, encontra uma vaga e se candidata —
tudo pelo navegador, com os dados pessoais cifrados e sem inscrição duplicada.

A abordagem técnica é uma aplicação Next.js única (React + rotas de API em Node,
TypeScript) sobre PostgreSQL via Prisma, com Auth.js para identidade e sessão em banco.
O schema relacional já nasce completo, incluindo as tabelas das Sprints 2 e 3, para não
exigir migração destrutiva com dados reais depois. O serviço Python/FastAPI da IA fica
como pasta reservada, sem código funcional nesta sprint.

O motor de triagem, o teste de código e o painel do recrutador estão fora desta entrega.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS. Python 3.12 reservado para
`services/ai` (Sprint 2).

**Primary Dependencies**: Next.js 15 (App Router), React 19, Auth.js (NextAuth v5),
Prisma 6, Zod (validação de entrada), Tailwind CSS.

**Storage**: PostgreSQL 16 (dados) + object storage compatível com S3, bucket privado
(currículos). Criptografia de aplicação AES-256-GCM sobre campos pessoais sensíveis.

**Testing**: Vitest (unidade + integração, com Postgres efêmero em Docker) e Playwright
(ponta a ponta e checagem de responsividade em 360 px / 1280 px).

**Target Platform**: navegadores modernos, desktop e mobile. Deploy em plataforma
serverless (Vercel Hobby) + Postgres gerenciado em tier gratuito.

**Project Type**: aplicação web full-stack em monorepo, com um serviço Python previsto.

**Performance Goals**: telas de listagem de vagas e perfil utilizáveis em ≤ 3 s com 50
usuários simultâneos (RNF03/SC-005); carregamento inicial abaixo de 2 s (RNF04).

**Constraints**: LGPD — dado pessoal cifrado em repouso e restrito por papel; acesso 100%
via navegador, sem instalação local; responsivo de 360 px a 1280 px+; orçamento de
protótipo (infra recorrente ≈ R$ 0/mês nos tiers gratuitos).

**Scale/Scope**: protótipo acadêmico — dezenas de candidatos, 5 vagas semeadas, ~12 telas.
Nesta sprint: 14 entidades no schema (9 ativas, 5 apenas modeladas), ~14 rotas de API,
8 telas.

## Constitution Check

*GATE: avaliado antes da Phase 0 e reavaliado após a Phase 1.*

| Princípio | Aplica-se nesta sprint? | Como o plano atende | Veredito |
|---|---|---|---|
| **I. Privacidade e LGPD por Padrão** (não-negociável) | Sim | AES-256-GCM em `Candidate.phone` e no conteúdo do currículo (R4); bucket privado com URL assinada (R5); verificação de papel no servidor em toda leitura de currículo e GitHub (FR-017); HTTPS pela plataforma de deploy; segredos só em variáveis de ambiente. Teste automatizado obrigatório de negação de acesso. | ✅ Passa |
| **II. Score Objetivo e Imutável** (não-negociável) | Parcialmente — nenhum score é gerado ainda | `Evaluation` nasce sem rota de update, com `version` para reprocessamento e trigger `BEFORE UPDATE` no Postgres. Teste automatizado obrigatório provando que o update falha. `Application.matchScore` fica nulo com status `NOT_CALCULATED` (FR-026). | ✅ Passa |
| **III. Triagem Sempre Mediada por IA** | Não — não há painel do recrutador nesta sprint | Nenhuma listagem de candidatos é exposta ao RH agora, então não há como violar o princípio. O campo `matchScoreStatus` já existe para a interface exibir "em processamento" em vez de dado parcial na Sprint 2. | ✅ N/A, sem violação |
| **IV. Isolamento na Execução de Código** (não-negociável) | Não — não há execução de código de candidato | `CodeSubmission`, `CodeDraft` e `Challenge` são criadas apenas como tabelas vazias. Nenhuma rota de execução existe. A infraestrutura do sandbox está decidida (R10: VM Oracle Cloud, **não** Vercel) e precisa estar provisionada antes de 02/Nov. | ✅ N/A nesta sprint |
| **V. Acesso Exclusivo via Navegador** | Sim | Aplicação web pura; todo o fluxo do candidato é completável no navegador. Playwright valida em 360 px e 1280 px (SC-006). | ✅ Passa |
| **VI. Simplicidade Orçamentária e Manutenibilidade** | Sim | Uma aplicação em vez de duas (R1); serviço Python só quando for necessário; tiers gratuitos; tipos gerados pelo Prisma nas fronteiras. | ✅ Passa |

**Restrições técnicas da constituição**: Next.js ✅ · FastAPI reservado ✅ · banco
relacional com candidato único por e-mail ✅ (R3) · integração GitHub com degradação
graciosa ✅ (R6) · segredos em variáveis de ambiente ✅.

**Item pendente, sem violação**: a constituição exige processamento pesado assíncrono com
estado observável. Nesta sprint o único processamento fora do request é a coleta do
GitHub, resolvida com estado `PENDING`/`CONNECTED`/`UNAVAILABLE` em `ExternalAccount` e
poll pelo cliente — suficiente para o volume atual. Uma fila de verdade passa a ser
necessária na Sprint 2, quando a triagem por IA entrar.

**Gate pós-Phase 1**: reavaliado após `data-model.md` e `contracts/api.md`. Nenhuma
decisão de design introduziu violação. Tabela de Complexity Tracking permanece vazia.

## Project Structure

### Documentation (this feature)

```text
specs/001-portal-candidatura/
├── plan.md              # Este arquivo
├── spec.md              # Requisitos (sem detalhe técnico)
├── research.md          # Phase 0 — 9 decisões técnicas
├── data-model.md        # Phase 1 — 10 entidades e transições de estado
├── quickstart.md        # Phase 1 — setup e roteiro de validação
├── contracts/
│   └── api.md           # Phase 1 — contratos HTTP
├── ers-divergences.md   # Divergências em relação ao ERS, com prazo de ação
├── checklists/
│   └── requirements.md  # Validação de qualidade da spec
└── tasks.md             # Phase 2 — gerado por /speckit-tasks
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma              # 14 entidades; 9 ativas, 5 apenas modeladas
├── migrations/                # inclui a trigger de imutabilidade de Evaluation
└── seed.ts                    # 5 vagas publicadas, pipelines, usuários de demo

src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                    # home
│   │   ├── vagas/page.tsx              # listagem + filtros      (FR-018, FR-019)
│   │   └── vagas/[id]/page.tsx         # detalhes + candidatura  (FR-020, FR-021)
│   ├── (auth)/
│   │   ├── entrar/page.tsx             # login                   (FR-002, FR-004)
│   │   └── cadastro/page.tsx           # cadastro                (FR-001)
│   ├── (candidate)/
│   │   ├── perfil/page.tsx             # perfil + currículo      (FR-009 … FR-017)
│   │   └── candidaturas/page.tsx       # minhas candidaturas     (FR-025)
│   ├── (recruiter)/
│   │   └── recrutamento/page.tsx       # tela mínima; painel é Sprint 2 (FR-006)
│   └── api/                            # route handlers finos — ver contracts/api.md
├── server/                             # regra de negócio testável, sem HTTP
│   ├── auth/                           # config Auth.js, hash de senha, papéis
│   ├── candidates/                     # perfil, contas externas, currículo
│   ├── jobs/                           # listagem, filtros, detalhes
│   ├── applications/                   # candidatura, unicidade, etapas
│   ├── integrations/github.ts          # coleta + degradação graciosa (R6)
│   ├── storage.ts                      # bucket privado + URL assinada
│   └── crypto.ts                       # AES-256-GCM (encrypt/decrypt)
├── components/                         # UI reutilizável
└── lib/                                # utilitários compartilhados

services/
└── ai/                                 # reservado — FastAPI, Sprint 2 (só README)

tests/
├── integration/                        # Vitest + Postgres efêmero
├── unit/
└── e2e/                                # Playwright, 360px e 1280px
```

**Structure Decision**: monorepo com uma aplicação Next.js na raiz e `services/ai`
reservado. A escolha vem de R1: entrega React e Node exigidos pelo ERS em um único deploy,
que é o que cabe no prazo de 14/09 e no orçamento.

A separação entre `src/app/api/` (casca HTTP) e `src/server/` (regra de negócio) é
deliberada — mantém a lógica testável sem subir servidor e barata de mover para um backend
separado, caso a equipe reverta a decisão R1 depois.

## Complexity Tracking

> Preenchido apenas se o Constitution Check apontar violações a justificar.

Nenhuma violação. Tabela intencionalmente vazia.
