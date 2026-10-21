# Feature Specification: Perfil Profissional Completo e Preenchimento pelo Currículo

**Feature Branch**: `007-perfil-completo`

**Created**: 2026-10-21

**Status**: Approved (design aprovado em conversa, 21/10)

**Input**: pedido do dono do produto — "no perfil, ter como colocar todas as informações
digitadas além do documento; quando jogo o documento, mostrar preenchidos os itens do
preenchimento".

**Por que esta spec existe**: hoje o perfil (FR-009) só guarda nome, telefone, cidade/UF,
o arquivo do currículo e as contas externas. Tudo o que descreve a carreira do candidato
existe só dentro do PDF, como texto bruto (`Resume.extractedText`). O recrutador não vê
experiências nem formação de forma estruturada, e o candidato sem currículo em arquivo não
tem onde informá-las. Fecha também a pendência da 003 US3.1 ("Cargo/senioridade no topo do
perfil não existe no modelo" — ORDEM-EXECUCAO.md, seção 4).

---

## Decisões (aprovadas)

| # | Decisão | Motivo |
|---|---|---|
| P1 | Leitura do currículo por **regras determinísticas**, sem LLM. | Segue D11; nenhum dado pessoal sai para terceiro (LGPD); custo zero. |
| P2 | Dados extraídos **preenchem só campos vazios na tela**, com selo "do currículo"; nada é gravado até o candidato clicar Salvar. | O parser erra em experiências/formação; o candidato é a autoridade. |
| P3 | **Tabelas próprias** (Experience, Education, Language, ProfileLink) + colunas no Candidate — não JSON. | Validação por campo, consulta pelo recrutador, export/exclusão LGPD explícitos. |
| P4 | Recrutador vê o perfil profissional no relatório da candidatura. | Razão de ser dos dados estruturados. |
| P5 | Campos novos **não são cifrados**. | Não são dado sensível (LGPD art. 5º, II); mesmo nível de cidade/UF. Telefone segue cifrado. |
| P6 | Perfil sem histórico de versões. | A candidatura já fixa o currículo da época (`Application.resumeId`, FR-015). |

---

## User Scenarios & Testing

### User Story 1 — Candidato preenche o perfil à mão (Priority: P1)

O candidato, com ou sem currículo em arquivo, informa resumo, experiências, formação,
tecnologias, habilidades, idiomas e links profissionais em `/perfil`, e salva.

**Acceptance Scenarios**:

1. **Given** perfil vazio, **When** preenche título, resumo, duas experiências (uma atual),
   uma formação, tecnologias `React, Node.js`, idioma Inglês Avançado e um link de portfólio
   e clica Salvar, **Then** recarregar a página mostra exatamente o que foi salvo, na mesma ordem.
2. **Given** experiências e formação, **When** clica "+ Adicionar" ou "Remover", **Then** a
   lista cresce/encolhe sem limite mínimo (zero é válido).
3. **Given** experiência com "Trabalho aqui atualmente" marcado, **Then** o campo de fim
   some e é gravado `endDate = null`.
4. **Given** fim anterior ao início, ou link sem `https://`, **When** salva, **Then** recebe
   400 com mensagem clara e nada é gravado.

### User Story 2 — Currículo preenche o formulário (Priority: P1)

**Acceptance Scenarios**:

1. **Given** perfil vazio, **When** envia um PDF/DOCX legível, **Then** a tela preenche os
   campos que o parser encontrou, marca cada um com o selo "do currículo" e mostra
   "Preenchemos N campos com base no currículo. Revise e salve." Nada foi gravado no perfil.
2. **Given** campo já preenchido pelo candidato (salvo ou digitado), **When** envia currículo,
   **Then** o campo não muda. Listas (experiências, formação, idiomas, links) só são
   preenchidas se estiverem vazias; tecnologias e habilidades são **unidas** (sem duplicar).
3. **Given** PDF escaneado (sem texto), **Then** nada é preenchido e vale o aviso existente
   "Texto não lido".

### User Story 3 — Recrutador vê o perfil profissional (Priority: P2)

**Acceptance Scenario**: no relatório da candidatura
(`/recrutamento/vagas/[id]/candidaturas/[applicationId]`), um card "Perfil profissional"
mostra título, resumo, experiências (mais recente primeiro), formação, idiomas,
tecnologias, habilidades e links. Seção vazia não aparece; perfil todo vazio mostra
"O candidato ainda não preencheu o perfil profissional."

### User Story 4 — Tecnologias do perfil contam no match (Priority: P2)

**Acceptance Scenario**: candidato sem currículo, com `technologies = ["React"]`, ganha
JobMatch com React em `matched` para vaga que exige React. Salvar o perfil recalcula o
match (gatilho novo, fire-and-forget como o do upload).

---

## Requisitos

- **FR-701** `Candidate` ganha `headline String?` (≤120), `summary String?` (≤2000),
  `technologies String[]`, `softSkills String[]` (≤40 itens cada, ≤40 caracteres por item).
- **FR-702** Tabelas `Experience` (company ≤120, role ≤120, startDate, endDate?, isCurrent,
  description? ≤2000), `Education` (institution ≤160, course ≤160, level `EducationLevel`,
  startDate?, endDate?, inProgress), `Language` (name ≤60, level `LanguageLevel`),
  `ProfileLink` (label ≤40, url https ≤300). Todas com `candidateId` (cascade) e `position`.
  Máximo 30 itens por lista.
- **FR-703** Datas são mês/ano; na API, string `YYYY-MM`; no banco, dia 1 às 00:00 UTC.
- **FR-704** `PATCH /api/me/profile` aceita os blocos novos; cada lista enviada **substitui**
  a lista inteira, numa transação. Bloco omitido não muda.
- **FR-705** `GET /api/me/profile` devolve os blocos novos.
- **FR-706** `POST /api/me/resume` devolve também `draft: ProfileDraft | null`, gerado de
  forma síncrona a partir do texto extraído no próprio upload.
- **FR-707** `parseResume(text)` é pura, nunca lança, e extrai: telefone BR, cidade/UF
  (validada contra as 27 UFs), links (GitHub/LinkedIn/Lattes/outros), tecnologias (catálogo
  fixo + tecnologias das vagas publicadas), resumo, experiências, formação, idiomas e
  habilidades por seção.
- **FR-708** Match: tecnologia conta como sinal de "currículo" se aparecer no texto do
  currículo **ou** em `Candidate.technologies`. Pesos 60/40 inalterados.
- **FR-709** Export LGPD (`GET /api/me/data-export`) inclui os blocos novos.
- **FR-710** Relatório da candidatura (`getApplicationDetail`) inclui o perfil profissional.

## Fora do escopo

- Busca/filtro de candidato por idioma, formação ou experiência.
- Extração com LLM; leitura de PDF escaneado (OCR).
- Preencher GitHub/LinkedIn/Lattes a partir dos links do currículo (só aparecem como
  sugestão de link em "Perfis profissionais").

## Testes

- Unitários: `tests/unit/resume-parse.test.ts`, `tests/unit/profile-draft.test.ts`
  (mescla do rascunho só em campos vazios), `tests/unit/match-score.test.ts` não muda.
- Integração: `tests/integration/profile-details.test.ts` (PATCH substitui listas,
  validação, isolamento por dono), `lgpd-rights` passa a conferir os blocos novos.
- **Atenção**: `.env.test.example` aponta para o mesmo banco do `.env` e o `setup.ts` dá
  TRUNCATE antes de cada teste. Os testes de integração só devem rodar com banco de teste
  separado.
