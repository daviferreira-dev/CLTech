# Sprint 3 — Análise de congruência e ordem de execução

**Data**: 2026-10-20
**Specs envolvidas**: `003-identidade-visual` (identidade visual e design system),
`004-fluxo-funcional-telas` (fluxo funcional do candidato e do recrutamento) e
`005-teste-tecnico` (RF05/RF06 — desafio de código e correção automática).

> **Revisão de 20/10 — lacuna encontrada**: as specs 003 e 004 cobriam apenas telas
> existentes. RF05 e RF06 (teste técnico de código) estão agendados para esta mesma Sprint 3
> desde a Sprint 1 e não estavam em nenhuma spec. A etapa `CODE_TEST` já é selecionável no
> `JobBuilder` desde a Sprint 2 e não tem comportamento algum — uma vaga que a escolhe trava
> o candidato. Daí a spec `005-teste-tecnico`. O item "Desafios Técnicos" das prints, antes
> descartado por falta de rota, passa a ser **condicionado** à entrega da 005.

---

## 1. Incongruências encontradas e como foram resolvidas

### 1.1 Entre as duas specs

| # | Incongruência | Resolução aplicada |
|---|---|---|
| A | Ambas reivindicavam o fluxo de navegação: o escopo da 003 dizia "reorganização do fluxo de navegação entre as telas" e suas US4/US5 traziam critérios de destino de ação, idênticos aos da 004. Dois donos para o mesmo critério = um deles envelhece em silêncio. | A 003 passou a declarar fronteira explícita: entrega os **componentes**; a 004 decide **quando e para onde** apontam. US4/US5 da 003 foram reescritas como critérios puramente visuais. |
| B | `FR-008` (confirmação em ação destrutiva) e `FR-009` (breadcrumbs) da 003 duplicavam `FR-105` e `FR-106` da 004. | `FR-008` da 003 virou "fornecer `ConfirmDialog` e `Breadcrumb` acessíveis"; o *quando usar* ficou só na 004. |
| C | A 003 definia escala de match com 3 faixas cobrindo apenas `CALCULATED`, enquanto a 004 (`FR-109`) exige tratamento distinto para os 5 estados que a API devolve. Três estados ficariam sem renderização definida. | Novo `FR-009` na 003 cobre os cinco estados; `FR-010` passou a tratar só a escala de cor dentro de `CALCULATED`. |
| D | A 003 travava os filtros em `workMode` + `seniority` e não mencionava paginação; a 004 exigia todo estado de lista na query string. | Ambas alinhadas aos seis parâmetros que `jobListQuerySchema` já aceita. |

### 1.2 Entre as specs e o código

| # | Incongruência | Resolução aplicada |
|---|---|---|
| E | **Filtros subdeclarados.** `src/lib/validation/jobs.ts` já aceita `q`, `technology`, `page` e `pageSize`; `JobsList` usa só `workMode` e `seniority`. A 003 proibia "filtros inventados" e acabava proibindo também os que já existem. | Busca textual e paginação entram no escopo visual — não exigem mudança de API, só uso do que já está no schema. |
| F | **"Dados Extraídos do Currículo".** A 003 pedia um cartão com senioridade, área, tempo de experiência, formação, nível de inglês, competências e resumo. Nada disso existe: o modelo `Resume` guarda apenas `extractedText` cifrado e um `parseStatus`. Implementar exigiria schema, parser e endpoints novos — o oposto do "só identidade". | Removido desta sprint; vira backlog de feature. O que sobra é o selo baseado em `parseStatus` (`PARSED` / `FAILED`), que tem lastro real. |
| G | **"Desafios Técnicos" no menu.** Sem rota, modelo ou endpoint. Um item de menu sem destino é um beco — exatamente o que a 004 (`SC-104`) proíbe. | Removido do `AppHeader`. |
| H | **Sino de notificações.** Nenhum modelo de notificação no Prisma (`grep notification` não retorna nada). | Removido do `AppHeader`. |
| L | **RF05/RF06 ausentes.** As duas specs tratavam só de telas existentes, enquanto o teste técnico — escopo declarado da Sprint 3 — não tinha spec nenhuma. `CODE_TEST` selecionável sem comportamento é um beco funcional no pipeline. | Criada a spec `005-teste-tecnico`; Fase 4.5 na ordem, com a infraestrutura como trilha paralela desde o dia 1. |
| M | **RN005 (feedback automático por e-mail, Resend — D6)** também está no cronograma da Sprint 3 e não está em nenhuma das quatro specs. | **Em aberto — decisão sua**: entra na Sprint 3 ou é adiada. Registrado nos riscos da 005. |
| I | **Elementos de vaga sem campo**: faixa salarial, vínculo CLT/PJ, benefícios, selos "Vaga Oficial" e "Contratação Imediata", "Score do seu perfil 94/100". | Documentados em tabela na 003 como fora de escopo, com o motivo. |

### 1.3 Riscos de ordem que as specs criavam entre si

| # | Problema | Resolução |
|---|---|---|
| J | A 003 reescreve `JobsList`, `JobDetail`, `ProfileForm`, `Dashboard`; a 004 reescreve **os mesmos arquivos** para mover filtros para a URL e trocar o destino pós-candidatura. Executar as specs em sequência fechada significa tocar cada arquivo duas vezes e refazer trabalho. | A ordem abaixo quebra a 003 em fundação + aplicação, e funde aplicação visual com fluxo **por tela**, num passo só por arquivo. |
| K | A 004 (`SC-103`) exige teste E2E novo por código de erro; a 003 (`NFR-004`) só pedia "sem regressão". O custo de teste estava subdeclarado. | A fase 5 da ordem reserva o trabalho de E2E explicitamente. |

Nenhuma contradição de contrato foi encontrada: as duas specs proíbem igualmente alterar
`src/app/api`, `src/server` e `prisma`, e os códigos de erro citados na 004 conferem com os
que `src/server/**` realmente lança.

---

## 2. Ordem de execução

A unidade de trabalho é a **fatia por tela**, não a spec inteira. Cada arquivo de tela é
tocado uma única vez, já com estilo e fluxo.

### Fase 0 — Inventário de testes (bloqueia tudo)

Levantar todo seletor de texto visível usado em `tests/` e Playwright. Qualquer rótulo que
mudará nas fases seguintes é identificado aqui, não descoberto na suíte vermelha.
*Fonte*: 003 NFR-004, 004 risco de `JobDetail`.

### Fase 1 — Fundação visual (003, sem tocar em tela)

Tokens em `globals.css` + `tailwind.config.ts`; `src/components/ui/*`;
`src/components/layout/*`. Nenhum arquivo de rota muda. Entregável verificável sozinho.
*Fonte*: 003 — direção visual, design system, FR-001, FR-002, FR-009, FR-010.

### Fase 2 — Shell e guardas (003 + 004, transversal)

`AppShell` aplicado aos layouts; regra de guarda `FR-G` uniformizada em todas as rotas
protegidas; tela de não encontrado. É a primeira fase que mexe em rota, e mexe em todas de
uma vez — por isso vem antes das telas individuais.
*Fonte*: 003 US1; 004 FR-101, US7.

### Fase 3 — Fatia do candidato

Ordem interna, cada passo uma tela completa (estilo + fluxo + estados):

1. `/vagas` — `JobsList`: design system, filtros `q`/`technology`/`workMode`/`seniority` e
   paginação na query string, os cinco estados de match, skeleton/vazio/erro.
2. `/vagas/[id]` — `JobDetail`: trilha de etapas, tecnologias encontradas/ausentes, ação
   fixa no mobile, e tradução de `RESUME_REQUIRED` / `ALREADY_APPLIED` / `JOB_NOT_OPEN` em
   próximo passo. Aqui muda o destino pós-candidatura — conferir com a Fase 0.
3. `/perfil` — `ProfileForm`: cartões de identidade, dados básicos, contas externas (3
   providers × 4 status), currículo com `parseStatus`, retorno via `?next=`.
4. `/candidaturas`: cartões com status, etapa na trilha, estado vazio.

*Fonte*: 003 US2, US3, US4; 004 US1, US2, US3.

### Fase 4 — Fatia do recrutamento

1. `/recrutamento` — painel: cartões de métrica, contagem por etapa navegável.
2. `/recrutamento/vagas` e `/vagas/nova` — `JobBuilder`: ordem de etapas preservada (maior
   risco de regressão da sprint), `INCOMPLETE_JOB` / `ALREADY_PUBLISHED` / `JOB_LOCKED`,
   confirmação ao descartar rascunho.
3. `/recrutamento/vagas/[id]/candidaturas` — recorte por etapa na URL.
4. `/…/[applicationId]` — relatório, breadcrumb ciente da origem, avançar/reprovar com
   confirmação, `APPLICATION_CLOSED`.
5. `/recrutamento/candidatos` — busca com critérios na URL.

*Fonte*: 003 US5; 004 US4, US5, US6.

### Fase 4.5 — Teste técnico (005) — trilha paralela, não sequencial

Esta fase **não espera** as anteriores e não deve ser espremida no fim. Divide-se em duas
trilhas que correm em paralelo às Fases 1–4:

- **Trilha A — infraestrutura, começa imediatamente**: provisionar a VM Oracle Cloud Always
  Free com Judge0 (R10) e fechar o D5 (`maxTestRuns`, política de fila). É o item de maior
  prazo da sprint e não depende de uma linha de código. Atrasar isto atrasa a sprint
  inteira.
- **Trilha B — código, depende da Trilha A e da Fase 1**: catálogo de desafios, configuração
  de `CODE_TEST` no `JobBuilder` (encaixa na Fase 4.2), tela do candidato com editor,
  autosave e cronômetro, motor de correção e `Evaluation`, exibição no relatório do
  recrutador. Nasce já usando o design system (Fase 1) e as regras de fluxo da 004 —
  `NFR-203` proíbe repaginação posterior.

Ao entregar, o item "Desafios Técnicos" entra no `AppHeader`.
*Fonte*: 005 completa.

### Fase 5 — Autenticação e cobertura

`/entrar` e `/cadastro` no novo padrão; E2E por código de erro (`SC-103`); varredura final
de classe de cor crua (`SC-001`); responsividade 360/768/1280 e passagem por teclado.

Sobre `SC-004` / `SC-106` ("nenhum arquivo em `src/app/api`, `src/server` ou `prisma`
alterado"): o critério vale para os **commits das specs 003 e 004**, não para os da 005, que
necessariamente cria rotas, serviços e migração. Verificar por commit, não por diff da
sprint inteira — caso contrário o critério falha por motivo errado.

*Fonte*: 003 US6, SC-001..SC-005; 004 SC-101..SC-106; 005 SC-201..SC-205.

---

## 3. Por que não executar 003 inteira e depois 004 inteira

Seria mais simples de gerenciar e mais caro de fazer: `JobsList`, `JobDetail`, `ProfileForm`
e `Dashboard` seriam reescritos duas vezes, e a segunda reescrita invalidaria parte dos
testes criados na primeira. A fatia por tela mantém as duas specs como critérios de aceite
independentes — cada uma continua verificável sozinha ao fim da Fase 5 — sem pagar o
retrabalho.
