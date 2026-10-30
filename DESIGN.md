---
version: 2
name: CLTech
description: Plataforma de seleção técnica da 3aq. Navy como base da marca, azul royal na ação e verde-água só para o que foi aprovado; tipografia geométrica (Outfit nos títulos, Plus Jakarta Sans no texto) e o símbolo hexagonal como assinatura.

# Paleta da marca (referência). O código usa os tokens abaixo.
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

# Tokens por intenção (src/app/globals.css). Componentes usam só estes nomes. claro | escuro
tokens:
  page:           ["#EEF3F9", "#091324"]
  surface:        ["#FFFFFF", "#111F36"]
  raised:         ["#FFFFFF", "#1A2B48"]  # popovers, diálogos, menus
  fg:             ["#0F1F39", "#E8EEF7"]
  fg-muted:       ["#5B6577", "#AAB6CA"]
  fg-subtle:      ["#697283", "#909DB4"]
  line:           ["#E3E8EF", "#293A59"]
  action:         ["#3B68F7", "#3B68F7"]
  action-hover:   ["#2C5AE9", "#2C5AE9"]
  action-soft:    ["#E8EEFE", "#1D3062"]
  link:           ["#2C5AE9", "#8FA9FF"]
  focus:          ["#3B68F7", "#8FA9FF"]
  success:        ["#39C9A5", "#39C9A5"]
  success-strong: ["#11806A", "#5FD9B8"]
  success-soft:   ["#E3F7F1", "#0D3A34"]
  success-ink:    ["#0B5545", "#8CEBD2"]
  warning:        ["#9A5A00", "#F0AA46"]
  danger:         ["#D1343A", "#FF8084"]
  inverse:        ["#0F1F39", "#1B2D4F"]  # painéis navy, editor de código
  inverse-raised: ["#1B2D4F", "#263C64"]
  on-color:       ["#FFFFFF", "#FFFFFF"]  # texto sobre action e inverse
  on-color-muted: ["#E3E8EF", "#C9D3E3"]

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

O CLTech é uma ferramenta de trabalho para recrutadores e uma porta de entrada para candidatos. A interface tem tema claro e escuro (fundo `page`, cartões `surface`), com a marca concentrada em três lugares: o símbolo hexagonal no header, o botão primário azul e o painel navy da tela de acesso.

## Cores

- **Tokens por intenção.** A paleta da marca (navy, royal, verde-água) só aparece em `globals.css`; o código usa `page`, `surface`, `raised`, `fg`, `fg-muted`, `line`, `action`, `link`, `success`, `warning`, `danger`, `inverse`, `on-color`. Nada de hex ou branco puro em componente (exceção: as cores oficiais do GitHub e do LinkedIn).
- **Uma cor por papel.** `action` é ação (botão primário, aba e menu ativos); `focus` é o anel de foco. `success` significa "passou": selo Recomendado, conta verificada, etapa concluída.
- Verde-água nunca vira texto sobre `surface`; para texto use `success-strong`, ou `success-ink` sobre `success-soft`. Sobre `bg-success`, o texto é `text-inverse`.
- Bordas de cartão em `line`; campos e botão secundário com borda `fg-subtle/50`.
- Todos os pares de texto passam WCAG AA (≥ 4.5:1) nos dois temas.

### Tema escuro

- O navy vira a base (`page` #091324, `surface` #111F36) e o azul royal continua sendo a ação, com o mesmo branco por cima. Links e foco clareiam (`#8FA9FF`) para manter o contraste.
- Segue `prefers-color-scheme` por padrão. O botão no `AppHeader` alterna sistema → claro → escuro e salva em `localStorage` (`theme`). Um script inline no `<head>` aplica `data-theme` antes da primeira pintura.
- Painéis `inverse` (acesso, home, editor de código) ficam um tom acima da página no escuro, não abaixo.
- E-mails ficam só no tema claro.

## Tipografia

Carregadas por `next/font/google` em `src/app/layout.tsx` (variáveis `--font-body`, `--font-display`, `--font-mono`). Títulos de página e de cartão em `font-display` (Outfit); todo o resto em `font-sans` (Plus Jakarta Sans); código e números de teste em `font-mono`.

## Componentes

- **Botão:** sempre `rounded-full`. Primário azul; secundário em `surface` com borda; danger contornado em vermelho (preenche só no hover). Uma ação primária por área.
- **Selos:** pílulas com fundo pálido e texto escuro do mesmo matiz; nunca só cor, sempre palavra.
- **StageTrail:** concluída em verde-água pálido com ✓, atual em azul sólido, futura contornada.
- **Avatar:** iniciais em `link` sobre `action-soft`.
- **Ícones:** um único conjunto em `src/components/ui/Icon.tsx` (SVG inline, traço 2px, grade 24, desenho no estilo Lucide). Nada de glifos de texto (∅ ! ☰ × › →) como ícone. Ícone é sempre decorativo (`aria-hidden`); o sentido vai no texto ou no `aria-label` do botão.
- **Estado de erro (`ErrorState`):** o quê → por quê → como. Título diz o que falhou ("Não conseguimos carregar…"), a descrição dá a causa provável e há duas saídas: "Tentar de novo" e um caminho para fora (voltar à lista, ao painel).
- **Telas de decisão:** o que a pessoa decide lidera. No relatório do candidato, uma faixa no topo junta compatibilidade, recomendação, etapa atual e Avançar/Reprovar; os cartões abaixo são o detalhe.
- **Alvos de toque:** mínimo 24×24px (WCAG 2.5.8). Links em linha isolados (breadcrumb, rodapé, título de cartão) usam `inline-flex min-h-6`; cartão de lista é clicável inteiro (`after:absolute after:inset-0` no link do título).
- **Senha:** campo com botão mostrar/ocultar (`PasswordInput`); erros de formulário aparecem sob o campo, com `aria-invalid` e `aria-describedby`, nunca só no balão do navegador.

## Contas externas (GitHub e LinkedIn)

Os ícones de marca ficam em `src/components/ui/BrandIcons.tsx` (`GitHubIcon`, `LinkedInIcon`, `ProviderIcon`) e aparecem onde a conta importa:

- **Acesso (`/entrar`, `/cadastro`):** "Entrar com GitHub" (botão preto #181717) e "Entrar com LinkedIn" (branco, ícone #0A66C2) acima do e-mail, com a frase de que o portfólio chega verificado. O botão do LinkedIn só aparece quando o provedor está configurado (`LINKEDIN_ID`); sem ele, a tela mostra só o GitHub.
- **Perfil do candidato:** cada conta conectada mostra o ícone do provedor; GitHub em quadro preto.
- **Relatório do recrutador:** ícone do provedor ao lado do nome da conta, com o selo Verificado quando a conta foi confirmada por login.
- Ícone de terceiros nunca é recolorido além da cor oficial (preto para GitHub, #0A66C2 para LinkedIn).

## Textos

- Caixa de frase em títulos, menus e botões ("Minhas vagas", "Criar vaga"). O item do menu e o H1 da página têm o mesmo nome.
- "Compatibilidade", nunca "match", em qualquer tela.
- Plural de verdade ("1 caso visível", "3 casos ocultos"), nunca "caso(s)".
- Sucesso diz o próximo passo, sem "com sucesso!".
- Cada página tem `<title>` próprio no formato "Página — CLTech" (template em `src/app/layout.tsx`).

## Logo

`public/brand/cltech-mark.png` (símbolo) e o componente `Logo` em `BrandIcons.tsx`, que monta símbolo + nome em Outfit. Sobre fundo escuro use `tone="light"` (símbolo sobre placa branca). O favicon é `src/app/icon.png`. Pendente: trocar o PNG por um SVG vetorial do símbolo original.

## Faça / não faça

- Faça: uma ação primária azul por tela; estados sempre com palavra; foco visível em azul.
- Não faça: tema escuro sem antes criar tokens semânticos (decisão de produto pendente), gradientes, sombras em cartões em repouso, emoji, verde-água como texto, mais de duas famílias tipográficas por tela.
