# Diagramas — o que abrir e em que ordem

Todos os `.drawio` já estão **corrigidos**. Falta só abrir, conferir e exportar o PNG.

## Abrir em https://app.diagrams.net

| Ordem | Arquivo | Vai para | O que fazer |
|---|---|---|---|
| 1 | `Diagrama_DER.drawio` | ERS — anexo / §5.5 | conferir e exportar PNG |
| 2 | `Diagrama_Classes.drawio` | ERS §5.2 | conferir e exportar PNG |
| 3 | `Diagrama_Casos_de_Uso.drawio` | ERS §5.1 | conferir e exportar PNG |
| 4 | `Diagrama_Sequencia1.drawio` | ERS §5.3.1 | **ver passo extra abaixo**, depois exportar |
| 5 | `Diagrama_Sequencia_2.drawio` | ERS §5.3.2 | **ver passo extra abaixo**, depois exportar |

Ao exportar: `File → Export as → PNG`, com **"Include a copy of my diagram"** marcada.
É isso que mantém o PNG reabrível no draw.io depois.

## Passo extra — só nos dois de sequência

O desenho está congelado em formas; o texto Mermaid corrigido está guardado dentro do
arquivo. Para o desenho refletir a correção:

> botão direito no diagrama → **Edit…** → a janela do Mermaid abre com o texto já
> corrigido → **Insert**

Se a janela não abrir, cole o texto de `Sequencia_1_texto_mermaid.txt` /
`Sequencia_2_texto_mermaid.txt` em `Arrange → Insert → Advanced → Mermaid`.

## Ainda não prontos

| Arquivo | Vai para | Estado |
|---|---|---|
| `Atividade_1_Candidatura.puml` | ERS §5.4.1 | fonte pronta — exportar em https://www.plantuml.com/plantuml |
| `Atividade_2_Correcao.puml` | ERS §5.4.2 | idem |

## `_backup/`

PNGs antigos (conteúdo **desatualizado**, não usar) e as fontes do modelo de dados
alternativo que foi descartado. Guardado só por segurança.
