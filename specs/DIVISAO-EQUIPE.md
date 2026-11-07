# Divisão da próxima rodada — "avaliação justa e rápida"

**Data**: 2026-11-07 · **Base**: proposta da demanda da 3aq (`docs/entregas/PROPOSTA_INICIAL_DEMANDA.pdf`)
e o levantamento de funcionalidades de 07/11.

## Quem faz o quê

| Spec | Responsável | Dor da 3aq que resolve | Migration |
|---|---|---|---|
| [`009-avaliacao-rh`](009-avaliacao-rh/spec.md) | **Davi** | "Cada avaliador tem uma opinião": ficha padrão de entrevista, motivo de reprovação com retorno ao candidato, ações em lote | **Sim** |
| [`010-velocidade-indicadores`](010-velocidade-indicadores/spec.md) | **Cassiano** | "Reduzir em 50% o tempo do anúncio à proposta": medir a meta, candidatos parados, resumo diário ao RH | Não |
| [`011-candidato-transparencia`](011-candidato-transparencia/spec.md) | **Guilherme** | "Feedback ao candidato" e "cuidado com viés": desistir, avisos no sistema, revisão humana (LGPD art. 20) | **Sim** |

## Combinados

1. **Uma branch por spec**, com o nome da spec (`009-avaliacao-rh` etc.), sempre a partir do `main` atualizado.
2. **Ordem de merge no `main`**: 010 (Cassiano) → 009 (Davi) → 011 (Guilherme).
   A 010 não tem migration e não depende de ninguém. A 011 lê dois campos que a 009 cria.
3. **Migrations**: cada um cria só a sua e nunca edita a de outra pessoa. Antes de abrir o PR,
   atualizar a branch com o `main`; se o `schema.prisma` mudou nesse meio-tempo, apagar a
   própria migration (ainda não aplicada em lugar nenhum além do seu banco local) e gerar de novo.
4. **Toda migration nova tem de ser aplicada à mão em produção antes do deploy** (como em 07/11).
   Quem faz o merge avisa no grupo.
5. **Arquivos compartilhados** — mexer só no trecho combinado:

   | Arquivo | 009 (Davi) | 010 (Cassiano) | 011 (Guilherme) |
   |---|---|---|---|
   | `prisma/schema.prisma` | `InterviewEvaluation`, `RejectionReason`, 2 colunas em `Application` | — | `Notification`, `ReviewRequest` |
   | `src/server/email/notify.ts` | parâmetros do `notifyApplicationClosed` | — | uma chamada de `createNotification` por função |
   | `ApplicationDetailView.tsx` | uma linha que inclui `InterviewEvaluationCard` + diálogo de reprovar | — | uma linha que inclui `ReviewRequestCard` |
   | `Dashboard.tsx` | — | card da meta e lista de parados | — |

6. **Contrato entre 009 e 011**: `Application.rejectionReason` e `Application.rejectionFeedback`.
   Davi não renomeia depois do merge; Guilherme só lê.
7. **Banco local de cada um**: um banco só seu (ex.: `cltech_009` / `cltech_009_test`) no
   `cltech-postgres`. Nunca apontar o `.env` para o banco de produção.
8. **Pronto para PR** = `pnpm lint`, `pnpm exec tsc --noEmit`, unitários, integração e
   Playwright passando (Playwright com `E2E_BASE_URL` se não for a porta 3000).

## Decisões que a equipe precisa tomar antes ou durante

- **009 FR-909**: as fichas de entrevista entram no export LGPD do candidato?
- **011 D6**: mostrar ao candidato quais tecnologias foram encontradas ou não no perfil dele.
  Muda o Princípio I e o FR-108 da spec 004: só com aprovação da equipe e do orientador.
- **010 D2**: a 3aq precisa informar o tempo médio de hoje (anúncio → proposta) para
  `HIRING_BASELINE_DAYS`. Sem esse número não dá para mostrar a redução de 50%.

## Próxima rodada (depois destas três no `main`)

- **Davi**: prazo de guarda dos dados (LGPD) e e-mail com nova tentativa quando o envio falha.
- **Cassiano**: banco de talentos vivo, com histórico de candidaturas anteriores, convite
  para vaga nova e busca com o Gemini.
- **Guilherme**: detecção de cola no teste de código.
