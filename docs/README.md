# docs — Documentação acadêmica da CLTech

Artefatos exigidos pela disciplina, organizados por tipo.

```text
docs/
├── diagramas/    Casos de uso, classes, DER, sequência, atividade
├── prototipo/    Protótipo das interfaces e navegação
└── entregas/     Checklists e evidências por sprint
```

A documentação **técnica** (requisitos detalhados, decisões de arquitetura, modelo de dados
e contratos de API) fica em [`specs/`](../specs/), não aqui.

## Entregáveis da Sprint 1 — 14/09/2026

| # | Entregável | Situação | Onde |
|---|---|---|---|
| 1 | Documento da demanda + evidência na SAGA | ✅ Pronto | [`entregas/PROPOSTA_INICIAL_DEMANDA.pdf`](entregas/PROPOSTA_INICIAL_DEMANDA.pdf) |
| 2 | ERS — Especificação de Requisitos de Software | ✅ Pronto | [`CLTech - ERS.docx`](../CLTech%20-%20ERS.docx) |
| 3 | Lista priorizada de RF, RNF e RN | ✅ Pronto | ERS, seção 2.4 |
| 4 | Fluxos, subfluxos, alternativas e exceções dos RF | ✅ Pronto | ERS, seção 2.1 |
| 5 | Cenários de verificação de todos os RNF | ⬜ Pendente | `entregas/` |
| 6 | Diagrama de casos de uso | ✅ Pronto | [`diagramas/Diagrama_Casos_de_Uso.drawio.png`](diagramas/Diagrama_Casos_de_Uso.drawio.png) |
| 7 | Diagrama de classes | ✅ Pronto | [`diagramas/Diagrama_Classes.drawio.png`](diagramas/Diagrama_Classes.drawio.png) |
| 8 | Diagrama Entidade-Relacionamento (DER) | ✅ Pronto | [`diagramas/Diagrama_DER.drawio.png`](diagramas/Diagrama_DER.drawio.png) |
| 9 | Dois diagramas de sequência dos processos principais | 🟡 Fonte pronta, falta exportar PNG | [`diagramas/Diagrama_Sequencia1.drawio`](diagramas/Diagrama_Sequencia1.drawio) · [`Diagrama_Sequencia_2.drawio`](diagramas/Diagrama_Sequencia_2.drawio) |
| 9b | Dois diagramas de atividade (ERS seção 5.4) | 🟡 Fonte pronta, falta exportar | [`Atividade_1_Candidatura.puml`](diagramas/Atividade_1_Candidatura.puml) · [`Atividade_2_Correcao.puml`](diagramas/Atividade_2_Correcao.puml) |
| 10 | Protótipo das 3 principais interfaces e navegação | ⬜ Pendente | `prototipo/` |
| 11 | Matriz de integração das unidades curriculares | ⬜ Pendente | `entregas/` |
| 12 | Repositório com README e estrutura inicial | ✅ Pronto | [README](../README.md) |

> **Como renderizar e exportar os diagramas, e os textos prontos para colar nas seções 5.1 e
> 5.2 do ERS**: ver [`diagramas/LEIA-ME.md`](diagramas/LEIA-ME.md).

## Fontes para os itens pendentes

Os artefatos abaixo já contêm o conteúdo necessário para produzir os diagramas — não é
preciso partir do zero:

| Para produzir | Use como fonte |
|---|---|
| Diagrama de classes e DER | [`data-model.md`](../specs/001-portal-candidatura/data-model.md) — 14 entidades com campos, tipos e relações |
| Diagramas de sequência | [`spec.md`](../specs/001-portal-candidatura/spec.md) — cenários de aceitação; e [`contracts/api.md`](../specs/001-portal-candidatura/contracts/api.md) — rotas e erros |
| Diagrama de casos de uso | ERS seção 2.1 — atores e RF01 a RF09 |
| Cenários de verificação dos RNF | ERS seção 2.2 e os critérios de sucesso SC-001 a SC-009 da spec |
| Protótipo | Telas listadas no [README do frontend](../frontend/README.md) |

## Divergências em relação ao ERS

Nove pontos em que a implementação difere do `CLTech - ERS.docx` v1.0 estão registrados,
justificados e com prazo de ação em
[`specs/001-portal-candidatura/ers-divergences.md`](../specs/001-portal-candidatura/ers-divergences.md).
Dois deles precisam ser levados para a próxima revisão do ERS antes da Sprint 2 — em
especial o **D4**, que altera o RF07 e **exige aval do professor**.

## Diagramas de sequência sugeridos

Os dois processos que melhor representam a solução:

1. **Candidatura a uma vaga** (RF03) — cobre autenticação, validação de currículo, criação
   da candidatura e o bloqueio de inscrição duplicada
2. **Correção automática do teste de código** (RF06) — cobre submissão, execução em
   sandbox, geração do relatório e avanço de etapa; é o núcleo da demanda da 3aq

## Convenções

- Diagramas versionados como **fonte** (`.mmd`, `.puml` ou `.drawio`) **e** como imagem
  exportada (`.png` ou `.svg`), para serem legíveis no GitHub e coláveis no ERS
- Nomes em português, coerentes com o vocabulário do ERS
- Toda entidade e requisito citado em diagrama usa o mesmo identificador do ERS (RF01, RN003…)
