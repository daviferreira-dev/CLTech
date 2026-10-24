# Sprint 2 — Dificuldades, decisões e mudanças de escopo

**Período:** 15/09 a 26/10/2026 · **Base:** [`ers-divergences.md`](../../specs/001-portal-candidatura/ers-divergences.md) (D1–D11),
[`ORDEM-EXECUCAO.md`](../../specs/ORDEM-EXECUCAO.md) e o histórico de commits.

## 1. Decisões de arquitetura

| # | Decisão | Por quê | Efeito na ERS |
|---|---|---|---|
| D11 | Motor de triagem dentro do Next.js, não num serviço Python separado | O cálculo é determinístico (tecnologias da vaga × currículo, perfil e GitHub). Um serviço à parte só somaria deploy, latência e um ponto de falha | `services/ai` fica reservado; revisar a menção a Python/FastAPI |
| D3 | Compatibilidade **pré-calculada** (`JobMatch`), recalculada quando o currículo, o GitHub ou a vaga mudam | Calcular na hora, a cada listagem, estouraria o RNF03 (≤ 3 s) | RF03 passo 4: "pré-calculado", não "em tempo real" |
| RN001 | A avaliação automática é gravada **na mesma transação** que cria a candidatura | Garante no banco que nenhuma candidatura chega ao RH sem triagem | — |
| RN003 | Score imutável: só inserção, com trigger `BEFORE UPDATE` no banco | Nenhuma tela ou rota consegue editar um score, nem por acesso direto | — |
| D10 | Sessão JWT em vez de sessão em banco | Limitação do Auth.js com login por senha | Ajustar a menção a "sessão em banco" |
| D4 | Painel com **métricas calculadas** (tempo médio, taxa de avanço, gargalo) no lugar de "insights gerados pela IA" | Gerar texto por IA exigiria serviço pago e não seria auditável | RF07 passo 5 — **aguarda aval do professor** |
| D9 | LinkedIn e Lattes viram link no perfil, sem coleta automática | As duas fontes não oferecem API pública utilizável | RF02 |

## 2. Dificuldades técnicas e como foram resolvidas

| Problema | Sintoma | Solução |
|---|---|---|
| Edições simultâneas do pipeline (`e22a44a`) | Dois cliques rápidos em "Adicionar etapa" gravavam o pipeline pela metade, e uma etapa sumia sem aviso | Transação serializável no servidor e envios em fila no cliente |
| Telas quebravam com a API fora (`6f1dc6a`) | "Application error" genérico em 4 listagens | Toda listagem trata erro e mostra lista vazia ou mensagem |
| Sessão de usuário apagado (`d4ceaa2`) | Cookie ainda válido gerava erro 500 em rotas de escrita | A sessão é confirmada no banco; usuário inexistente recebe 401 |
| Testes apagavam o banco em silêncio (`ff58bde`) | A suíte de integração limpava o banco de desenvolvimento e os E2E falhavam sem pista | O Vitest se recusa a rodar sem `.env.test.example` válido |
| Primeiro login com GitHub (24/10) | Conta criada sem perfil de candidato: perfil e candidatura davam "não encontrado" | Perfil criado junto com o usuário; teste novo |
| Teste em pasta com espaço no nome (24/10) | 25 testes de acesso LGPD falhavam fora da máquina de quem os escreveu | Import das rotas pelo alias do projeto |

## 3. Mudanças de escopo

| Item | Mudança | Situação |
|---|---|---|
| **RN005 — feedback por e-mail** | Adiado: sem provedor de e-mail ligado (D6). O candidato acompanha o status pela própria plataforma | Decidir na Sprint 3 se entra (Resend, gratuito) |
| **RF06 passo 5** | A correção automática **não** avança a etapa; quem decide é o recrutador | Emendar a ERS |
| **RF04-A2** | Vaga publicada trava tecnologias, requisitos e etapas, em vez de reprocessar scores | Emendar a ERS |
| **RF07, passo 4** | A comparação com o mês anterior não foi implementada; o painel mostra tempo médio, taxa de avanço e etapa gargalo | Levada ao orientador junto com a D4 |
| **RF05 (D5)** | Limite fixo de 20 execuções de teste antes da submissão | Definido; emendar a ERS |
| **RF05/RF06 adiantados** | Teste de código e correção implementados já nesta sprint (spec 005) | Falta a VM do sandbox (D2) |
| **LGPD adiantada** | Exportação de dados, exclusão de conta e auditoria de criptografia (spec 006) | Concluído |
| **Perfil completo** | Experiências, formação, idiomas e preenchimento pelo currículo (spec 007), fora do plano original | Concluído |

## 4. Pendências que passam para a Sprint 3

1. **VM do sandbox (Judge0)** e `SANDBOX_URL`: sem ela, o teste de código fica "correção em andamento" (D2).
2. **Agendar a rotina de expiração** dos testes (`POST /api/internal/code-tests/expire` com `CRON_SECRET`).
3. **Aval do professor sobre o RF07** (D4 e a comparação com o mês anterior).
4. **Emendas da ERS**: D1, D3, D4, D5, D8, D9, D11 e as mudanças da seção 3.
5. **Deploy** em ambiente público.
6. Decidir a **RN005** (e-mail).
