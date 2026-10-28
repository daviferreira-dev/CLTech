---
version: 2
name: CLTech
description: Plataforma de seleção técnica da 3aq. Navy como base da marca, azul royal na ação e verde-água só para o que foi aprovado; tipografia geométrica (Outfit nos títulos, Plus Jakarta Sans no texto) e o símbolo hexagonal como assinatura.

colors:
  brand-900: "#0F1F39"   # navy: marca, títulos, painel do acesso
  brand-700: "#1B2D4F"
  brand-100: "#E3E8EF"   # bordas e divisores
  primary-600: "#3B68F7" # azul royal: botão primário (4.7:1 com branco)
  primary-700: "#2C5AE9" # hover, links de texto
  primary-100: "#E8EEFE" # item de menu ativo, seleção
  accent-600: "#39C9A5"  # verde-água: só marcas (ponto, barra, check)
  accent-700: "#11806A"  # texto de aprovado
  accent-100: "#E3F7F1"  # fundo de selo positivo
  accent-900: "#0B5545"  # texto sobre accent-100
  canvas: "#EEF3F9"
  surface: "#FFFFFF"
  ink-900: "#0F1F39"
  ink-600: "#5B6577"
  ink-400: "#697283"
  danger-600: "#D1343A"
  warning-500: "#9A5A00"

typography:
  display: { fontFamily: Outfit, fontSize: 30px, fontWeight: 600, lineHeight: 36px, letterSpacing: -0.02em }
  h2: { fontFamily: Outfit, fontSize: 20px, fontWeight: 600, lineHeight: 28px }
  h3: { fontFamily: Plus Jakarta Sans, fontSize: 16px, fontWeight: 600, lineHeight: 24px }
  body: { fontFamily: Plus Jakarta Sans, fontSize: 14px, fontWeight: 400, lineHeight: 20px }
  label: { fontFamily: Plus Jakarta Sans, fontSize: 12px, fontWeight: 500, lineHeight: 16px }
  code: { fontFamily: JetBrains Mono, fontSize: 12px, lineHeight: 20px }

radius: { field: 10px, card: 14px, button: 9999px, badge: 9999px }
---

## Visão geral

O CLTech é uma ferramenta de trabalho para recrutadores e uma porta de entrada para candidatos. A interface é clara (`canvas` azulado, cartões `surface`), com a marca concentrada em três lugares: o símbolo hexagonal no header, o botão primário azul e o painel navy da tela de acesso.

## Cores

- **Uma cor por papel.** `primary-600` é ação (botão primário, aba e menu ativos, foco). `accent-600` significa "passou": selo Recomendado, conta verificada, etapa concluída. `brand-900` é marca e texto.
- Verde-água nunca vira texto sobre branco (2:1); para texto use `accent-700` ou `accent-900` sobre `accent-100`.
- Bordas de cartão em `brand-100`; campos e botão secundário com borda `ink-400/50`.
- Todos os pares de texto passam WCAG AA (≥ 4.5:1).

## Tipografia

Carregadas por `next/font/google` em `src/app/layout.tsx` (variáveis `--font-body`, `--font-display`, `--font-mono`). Títulos de página e de cartão em `font-display` (Outfit); todo o resto em `font-sans` (Plus Jakarta Sans); código e números de teste em `font-mono`.

## Componentes

- **Botão:** sempre `rounded-full`. Primário azul; secundário branco com borda; danger contornado em vermelho (preenche só no hover). Uma ação primária por área.
- **Selos:** pílulas com fundo pálido e texto escuro do mesmo matiz; nunca só cor, sempre palavra.
- **StageTrail:** concluída em verde-água pálido com ✓, atual em azul sólido, futura contornada.
- **Avatar:** iniciais em `primary-700` sobre `primary-100`.

## Contas externas (GitHub e LinkedIn)

Os ícones de marca ficam em `src/components/ui/BrandIcons.tsx` (`GitHubIcon`, `LinkedInIcon`, `ProviderIcon`) e aparecem onde a conta importa:

- **Acesso (`/entrar`, `/cadastro`):** "Entrar com GitHub" (botão preto #181717) e "Entrar com LinkedIn" (branco, ícone #0A66C2) acima do e-mail, com a frase de que o portfólio chega verificado.
- **Perfil do candidato:** cada conta conectada mostra o ícone do provedor; GitHub em quadro preto.
- **Relatório do recrutador:** ícone do provedor ao lado do nome da conta, com o selo Verificado quando a conta foi confirmada por login.
- Ícone de terceiros nunca é recolorido além da cor oficial (preto para GitHub, #0A66C2 para LinkedIn).

## Logo

`public/brand/cltech-mark.png` (símbolo) e o componente `Logo` em `BrandIcons.tsx`, que monta símbolo + nome em Outfit. Sobre fundo escuro use `tone="light"` (símbolo sobre placa branca). O favicon é `src/app/icon.png`. Pendente: trocar o PNG por um SVG vetorial do símbolo original.

## Faça / não faça

- Faça: uma ação primária azul por tela; estados sempre com palavra; foco visível em azul.
- Não faça: gradientes, sombras em cartões em repouso, emoji, verde-água como texto, mais de duas famílias tipográficas por tela.
