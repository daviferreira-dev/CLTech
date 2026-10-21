# Perfil Profissional Completo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Candidato preenche resumo, experiências, formação, tecnologias, habilidades, idiomas e links no `/perfil`; o upload do currículo pré-preenche os campos vazios na tela; recrutador vê o perfil no relatório da candidatura.

**Architecture:** Colunas novas em `Candidate` + 4 tabelas filhas (Prisma). Parser determinístico puro (`resume-parse.ts`) roda no upload e devolve um `ProfileDraft` no formato do formulário; a tela mescla o rascunho só nos campos vazios (`mergeDraft`, puro, em `src/lib/profile-form.ts`). `PATCH /api/me/profile` substitui listas inteiras numa transação.

**Tech Stack:** Next.js 15 (app router), Prisma/Postgres (Supabase), zod, Vitest, Tailwind.

**Spec:** `specs/007-perfil-completo/spec.md`

## Global Constraints

- Sem LLM no parser (D11). Parser nunca lança.
- Datas na API: `YYYY-MM`. No banco: dia 1, 00:00 UTC.
- Limites: headline ≤120, summary ≤2000, tags ≤40 itens × ≤40 chars, listas ≤30 itens, link `https://` ≤300.
- Nada do currículo é gravado no perfil sem o candidato clicar Salvar.
- Testes de integração NÃO rodam enquanto `.env.test.example` apontar para o banco de dev (TRUNCATE). Unitários rodam com config sem `setupFiles`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` + migration `20261021000000_profile_details` | Modelo (FR-701/702) |
| `src/lib/profile-details.ts` | Enums, rótulos, tipos `ProfileDetails` (compartilhado cliente/servidor) |
| `src/lib/profile-form.ts` | Estado do formulário, `fromProfile`, `mergeDraft`, `toPayload`, `formatMonth` |
| `src/lib/validation/profile.ts` | zod dos blocos novos |
| `src/server/candidates/tech-catalog.ts` | Catálogo fixo de tecnologias |
| `src/server/candidates/resume-parse.ts` | `parseResume(text, extraTechs) → ProfileDraft` |
| `src/server/candidates/profile-details.ts` | include Prisma, `toProfileDetails`, gravação das listas |
| `src/server/candidates/profile.ts` | GET/PATCH com blocos novos + gatilho de match |
| `src/server/candidates/resume.ts` | devolve `draft` |
| `src/server/matching/recompute.ts` | tecnologias do perfil como sinal |
| `src/server/candidates/privacy.ts` | export LGPD |
| `src/server/applications/detail.ts` | perfil no relatório |
| `src/components/ui/TagInput.tsx` | input de tags |
| `src/app/(candidate)/perfil/ProfileDetailsForm.tsx`, `ProfileListEditors.tsx` | formulário controlado |
| `src/app/(candidate)/perfil/ProfileForm.tsx` | orquestra upload → rascunho → formulário |
| `.../[applicationId]/ProfessionalProfileCard.tsx` | card do recrutador |

## Tasks

### Task 1: Modelo de dados
- [ ] Adicionar enums `EducationLevel`, `LanguageLevel`; colunas `headline`, `summary`, `technologies String[] @default([])`, `softSkills String[] @default([])` em `Candidate`; modelos `Experience`, `Education`, `Language`, `ProfileLink` (cada um: `id uuid`, `candidateId` FK cascade, `position Int`, campos da spec, `@@index([candidateId])`).
- [ ] Gerar SQL com `prisma migrate diff --from-schema-datasource --to-schema-datamodel --script`, salvar como migration, `prisma migrate deploy`, `prisma generate`.
- [ ] Commit.

### Task 2: Tipos compartilhados + validação
- **Produces:** `EDUCATION_LEVELS`, `LANGUAGE_LEVELS`, `EDUCATION_LEVEL_LABEL`, `LANGUAGE_LEVEL_LABEL`, `ProfileDetails`; `updateProfileSchema` estendido; `UpdateProfileInput`.
- [ ] zod: `month = /^\d{4}-(0[1-9]|1[0-2])$/`; experiência exige `endDate >= startDate` quando ambos existem; `isCurrent ⇒ endDate null`; link `url` começa com `https://`.
- [ ] Commit.

### Task 3: Parser (TDD)
- **Produces:** `parseResume(text: string, extraTechnologies?: string[]): ProfileDraft`.
- [ ] Testes em `tests/unit/resume-parse.test.ts`: telefone `(11) 98765-4321`; `São Paulo - SP`; links GitHub/LinkedIn/portfólio com rótulo; tecnologias por palavra inteira (`Java` não casa `JavaScript`); resumo pela seção; 2 experiências (uma "atual") com cargo/empresa/datas; formação com nível GRADUACAO; idiomas com nível; habilidades da seção; texto vazio → rascunho vazio.
- [ ] Rodar (falha) → implementar → rodar (passa) → commit.

### Task 4: Mescla do rascunho (TDD)
- **Produces:** `ProfileFormState`, `emptyForm`, `fromProfile(view)`, `mergeDraft(form, draft) → { form, filled: DraftField[] }`, `toPayload(form)`, `formatMonth("2021-03") → "mar/2021"`.
- [ ] Testes `tests/unit/profile-form.test.ts`: não sobrescreve escalar preenchido; preenche lista vazia; não toca lista não vazia; une tags sem duplicar (case-insensitive); `toPayload` descarta linhas vazias e converte `""` → `null`.
- [ ] Implementar → passa → commit.

### Task 5: Servidor (perfil, upload, match, LGPD, relatório)
- [ ] `profile-details.ts`: `profileDetailsInclude`, `toProfileDetails(candidate)`, `writeProfileDetails(tx, candidateId, input)` (deleteMany + createMany por lista enviada).
- [ ] `profile.ts`: `ProfileView` ganha `details: ProfileDetails`; `updateProfile` em transação interativa; dispara `recomputeJobMatchesForCandidate` se `technologies` veio.
- [ ] `resume.ts`: `draft = extractedText ? parseResume(extractedText, techsDasVagasPublicadas) : null` no retorno.
- [ ] `recompute.ts`: `resumeText = [extractedText, ...technologies].join("\n")` (null se ambos vazios); `recomputeJobMatchesForJob` inclui candidatos com tecnologias.
- [ ] `privacy.ts` e `detail.ts`: incluir `details`.
- [ ] `tsc --noEmit` → commit.

### Task 6: Tela do candidato
- [ ] `TagInput` (Enter/vírgula adiciona, × remove).
- [ ] `ProfileListEditors.tsx`: editores de Experiência/Formação/Idioma/Link com "+ Adicionar"/"Remover" e selo "do currículo".
- [ ] `ProfileDetailsForm.tsx`: estado controlado, recebe `draft` (com nonce) e aplica `mergeDraft`; aviso "Preenchemos N campos…"; salva via PATCH com `toPayload`.
- [ ] `ProfileForm.tsx`: currículo antes do formulário; upload guarda `draft`; título no card de identidade.
- [ ] `tsc`, lint → commit.

### Task 7: Card do recrutador
- [ ] `ProfessionalProfileCard.tsx` + uso em `ApplicationDetailView.tsx`.
- [ ] `tsc` → commit.

### Task 8: Verificação
- [ ] Unitários (config sem setup), `tsc --noEmit`, `pnpm lint`, `pnpm build`.
- [ ] Navegador: candidato envia currículo de exemplo → campos preenchidos com selo → salva → recarrega → recrutador vê card.
- [ ] Teste de integração `tests/integration/profile-details.test.ts` escrito (não executado até banco de teste separado).
