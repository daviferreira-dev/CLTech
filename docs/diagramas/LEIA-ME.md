# Diagramas — o que vai para a ERS

Revisão de 24/10/2026: todos os diagramas foram conferidos contra o código (`prisma/schema.prisma`
e `src/server`). Os PNGs abaixo já estão prontos para colar na ERS.

## Prontos (já colados no ERS v1.1)

| Seção da ERS | PNG | Fonte (para editar) |
|---|---|---|
| §5.1 Casos de uso (2 partes) | `Casos_de_Uso_1_Candidato.png`, `Casos_de_Uso_2_Recrutamento.png` | `Casos_de_Uso_*.puml`; versão única em `Diagrama_Casos_de_Uso.drawio` |
| §5.2 Classes | `Diagrama_Classes.png` | `Classes_mermaid.txt` |
| §5.3.1 Sequência — Criar vaga e pipeline (RF04) | `Sequencia_1_Criar_Vaga.png` | `Sequencia_1_texto_mermaid.txt` |
| §5.3.2 Sequência — Perfil, candidatura e triagem (RF02, RF03, RN001) | `Sequencia_2_Candidatura_Triagem.png` | `Sequencia_2_texto_mermaid.txt` |
| §5.3.3 Sequência — Teste de código e correção (RF05, RF06) | `Sequencia_4_Teste_Codigo.png` | `Sequencia_4_Teste_Codigo_mermaid.txt` |
| §5.4 DER | `Diagrama_DER.png` | `DER_mermaid.txt` |
| §5.5.1 Atividade — Candidatura | `Atividade_1_Candidatura.png` | `Atividade_1_Candidatura.puml` |
| §5.5.2 Atividade — Teste e correção | `Atividade_2_Correcao.png` | `Atividade_2_Correcao.puml` |
| (fora da ERS) Sequência — Autenticação (RF01) | `Sequencia_3_Autenticacao.png` | `Sequencia_3_Autenticacao_mermaid.txt` |

O cartão S1·9 do Trello pede sequências de processos ligados ao valor da solução, não de
login/cadastro; por isso a Sequência 3 ficou fora da ERS.

O casos de uso é apresentado em duas partes porque inteiro não cabe legível numa página. Ao
mudar um caso de uso, mudar o `.drawio` e o `.puml` correspondente.

## Como editar e gerar de novo

- **Mermaid (`.txt`)**: colar em `draw.io → Arrange → Insert → Advanced → Mermaid`, ou gerar o
  PNG com `npx @mermaid-js/mermaid-cli -i arquivo.txt -o arquivo.png -s 2 -b white`.
- **PlantUML (`.puml`)**: `java -jar plantuml.jar -charset UTF-8 arquivo.puml`, ou colar em
  https://www.plantuml.com/plantuml.

## O que foi corrigido em 24/10

| Diagrama | Correção |
|---|---|
| DER | Refeito do `schema.prisma`: 19 tabelas (antes 8). Entram JobMatch, Evaluation, Challenge, CodeDraft, CodeSubmission, perfil profissional (spec 007), contas externas e GitHub. Sai a tabela Recrutador, que não existe (o papel é um campo de User). Campos cifrados marcados. |
| Classes | Refeito: mesmas entidades do DER, enumerações principais e os serviços reais (motor de triagem, corretor e a interface Sandbox com Judge0). Sai a interface MotorIA com `enviarFeedbackEmail`, que não existe. |
| Casos de uso | Removido Recrutador → Realizar Cadastro (o cadastro só cria candidatos). O `<<include>>` de Candidatar-se agora liga de fato a "Ler e Triar Currículos". Novos: Acompanhar Candidaturas, Exportar Meus Dados e Excluir Conta (LGPD). |
| Sequência 1 | Rascunho fica no servidor (não em armazenamento local); etapas não têm "participantes"; publicação valida tecnologias, requisitos, etapas e desafio; vaga publicada fica travada. |
| Sequência 2 | Sem "Provedor SSO" na coleta (o GitHub é lido pela API pública), sem foto (não existe), vagas não são ordenadas por compatibilidade e o score é calculado antes de gravar a candidatura. |
| Sequência 3 | Faltava o login com GitHub (RF01-A1). |
| Sequência 4 | Faltavam sandbox indisponível no "Testar" e a falha persistente da correção. |
| Atividade 1 | O score agora é calculado e gravado junto com a candidatura (não "Sprint 2 / NOT_CALCULATED"). |
| Atividade 2 | A correção não avança a etapa (é decisão do recrutador), não há notificação nem e-mail, e estouro de tempo conta como caso reprovado em vez de "violação de segurança". |

## Divergências com a ERS que o diagrama mostra de propósito

- **RF06 passo 5 / RN005**: a ERS diz que a correção avança a etapa e envia feedback por e-mail.
  No sistema, quem avança é o recrutador, e o e-mail (Resend) ainda não foi implementado.
- **RF04-A2**: a ERS diz que editar vaga publicada reprocessa o score; no sistema, tecnologias,
  requisitos e etapas ficam travados após publicar.

## `_backup/`

Versões antigas, **desatualizadas — não usar**. O histórico completo também está no git.
