# Revisão de design e UX — CLTech

## Rodada 3 (30/10/2026) — tema escuro (P-13)

**Feito.** Tokens por intenção em `src/app/globals.css` (`page`, `surface`, `raised`, `fg`, `fg-muted`, `fg-subtle`, `line`, `action`, `action-hover`, `action-soft`, `link`, `focus`, `success*`, `warning`, `danger`, `inverse`, `on-color`), com valores claro e escuro, expostos no `tailwind.config.ts`. Os 47 arquivos de UI migraram dos nomes de paleta (`ink-*`, `brand-*`, `primary-*`, `accent-*`, `canvas`) para os tokens. O tema segue o sistema; o botão no cabeçalho alterna sistema → claro → escuro e salva em `localStorage`; um script inline no `<head>` aplica `data-theme` antes de pintar (sem flash). Popovers, menus e diálogos usam `raised`; o anel de foco ganhou `ring-offset-surface` (antes o offset era branco fixo). E-mails ficaram como estavam.

**Medição.** Script de contraste (todo nó de texto visível contra o fundo efetivo, nos dois temas, sem transições) no navegador embutido, a 1280px e 375px: início, vagas, entrar, minhas candidaturas, desafios, perfil, privacidade (candidato) e painel, minhas vagas, candidaturas da vaga, candidatos, catálogo de desafios, criar vaga (recrutador). **0 falhas AA** nos dois temas. Pares de token conferidos à parte: no escuro o menor par de texto é `fg-subtle` sobre `raised` (≥ 4,5:1); branco sobre `action` 4,7:1. Achados corrigidos no caminho: texto navy sobre verde-água virava claro no escuro (selo "Decisão da equipe", check da home) → `text-inverse`; check branco sobre verde-água (2:1) → `text-inverse`.

**Limites.** O plugin `ux-ui-agent-skills` (skills e agente `design-critic`) não estava instalado nesta sessão; a revisão seguiu os critérios das rodadas anteriores, à mão. O teste de código (`/desafios/[id]`) e o relatório com código não tinham dados para o candidato usado; o editor usa `inverse`/`on-color`, conferidos por par de token. Telas de auth não têm cabeçalho, então seguem a escolha salva ou o sistema, sem botão próprio.

| Dimensão | Rodada 2 | Rodada 3 |
|---|---|---|
| Consistência | 9 | 9,5 |
| Acessibilidade | 9 | 9 |
| Demais | = | = |
| **Geral** | **8,5** | **8,7** |

**Veredito:** *accept*. P-13 resolvido. Continuam abertos os itens 1, 2, 4–6 da rodada 2.

## Rodada 2 (30/10/2026, branch `design/revisao-nota-10`)

Todas as propostas da rodada 1 foram aplicadas, menos as fora de escopo (P-12 só no `DESIGN.md`, P-13 tema escuro, P-17 dados de E2E). Telas revistas no navegador embutido a 1280px e 375px, como recrutador (`recrutador@3aq.dev`) e como candidato novo (`design-dez-1030@example.test`), com o mesmo script de medição da rodada 1 (contraste WCAG de todo texto, alvos < 24px, campos sem rótulo, botões sem nome, títulos, rolagem horizontal).

**Limites desta rodada:** as skills e o agente do plugin `ux-ui-agent-skills` (`design-doctrine`, `design-review`, `a11y-audit`, `ux-writing`, `design-critic`) **não estavam instalados nesta sessão**; a revisão seguiu os mesmos critérios e pesos da rodada 1, aplicados à mão, e o veredito abaixo é meu, não do agente. Hover/foco não foram medidos um a um. Teste de código (`/desafios/[id]`) e Minhas candidaturas com dados foram revistos pelo código.

### O que mudou

| Item | Correção |
|---|---|
| P-4 + critic | Relatório do candidato abre com uma **faixa de decisão**: compatibilidade grande, selo Recomendado/Não recomendado, etapa atual com o selo de status ao lado, trilha de etapas e Avançar/Reprovar. "Etapa atual" aparece uma vez só; o cartão "Decisão" do fim saiu. |
| P-1 | Não reproduziu: o detalhe da vaga do recrutador e o breadcrumb das candidaturas carregam o nome da vaga. |
| P-2 | `<title>` por página com template "%s — CLTech"; nome da vaga, "Candidaturas · vaga" e "Nome · Relatório" via `generateMetadata` (só para quem pode ver; rascunho não vaza). |
| P-5, P-6 | Causa real: o `Suspense` de `/vagas` deixava no DOM uma cópia oculta da lista (`<div id="S:0" hidden>`), com H1 e ids duplicados — por isso os rótulos "soltos". Fronteira removida (a página já é dinâmica). Agora: 1 H1, 0 campos sem rótulo. |
| P-3, W-7 | `ErrorState` com ícone SVG, causa provável padrão e segunda saída em todas as telas ("Voltar para Minhas vagas", "Limpar filtros"…). |
| Glifos | `Icon.tsx` único (inbox, alert, menu, close, chevrons, arrow, check, search, eye). Saíram ∅ ! ☰ × › → ✓ e os SVGs soltos do `SelectMenu`, da busca e da home. Sem dependência nova. |
| P-7 | Detalhe da vaga com uma só ação primária ("Candidatar-se"); o aviso de perfil virou link de texto. |
| P-8 | Candidaturas da vaga: H1 é o nome da vaga; "Candidaturas · N pessoas" como subtítulo. |
| P-9, W-3 | Catálogo em grade de cartões compactos, enunciado em `<details>`, filtros de dificuldade e linguagem com contagem e estado vazio. Plural correto em todo lugar. |
| P-10 | Breadcrumb, rodapé, títulos-link e "Configurar" com `min-h-6`; cartões de candidato clicáveis inteiros; botão de remover chip 24×24. |
| P-11 | Login com validação em linha (`aria-invalid` + `aria-describedby`, sem balão nativo); `PasswordInput` com mostrar/ocultar no login e no cadastro. |
| P-14 | `jobPlace()`: "Remoto" em vez de "Remoto · Remoto" (lista, detalhe e home). |
| P-15 | Animações da home usam só opacidade/posição (`opacity` em vez de `autoAlpha`), então títulos não somem da árvore de acessibilidade; texto de apoio do hero em 18px. |
| P-16 + critic | Painel: gargalo do funil em destaque no topo (com link para a etapa quando há vaga recortada); KPIs em 2 colunas compactas no celular; vagas ordenadas por atividade, rascunhos tracejados no fim, total de candidatos no cartão. |
| W-1, W-2, W-4, W-5, W-6 | Caixa de frase; menu e H1 com o mesmo nome ("Vagas", "Painel", "Desafios"…); "compatibilidade" no lugar de "match"; "na etapa há 2 horas"; "Candidatura enviada. Acompanhe aqui cada etapa."; textos sem "aprovado(a)". |

### Notas

| Dimensão | Antes | Agora | Por quê |
|---|---|---|---|
| Hierarquia visual | 6,5 | 8,5 | Relatório e painel ganharam um foco; catálogo deixou de ser muro de texto. |
| Consistência | 6,5 | 9 | Um conjunto de ícones, caixa de frase, mesmo nome no menu e no H1, um termo para compatibilidade. |
| Acessibilidade | 7,5 | 9 | `<title>` por página, 1 H1, 0 campos sem rótulo, 0 títulos vazios, erros ligados ao campo, contraste sem falhas nas telas medidas. |
| Usabilidade | 6,5 | 8,5 | Erro com causa e saída, decisão no topo, filtro no catálogo, mostrar senha. |
| Responsividade | 8 | 8,5 | Nada estoura a 375px; KPIs compactos; faixa de decisão empilha com botões ao alcance. |
| Desempenho percebido | 6 | 6,5 | Mesmos 3–5 s em dev nas listas; o 500 não reproduziu. |
| **Geral (ponderado)** | **6,9** | **8,5** | |

| Tela | Antes | Agora | Comentário |
|---|---|---|---|
| Início | 7,5 | 8,5 | Títulos sempre na árvore; texto de apoio maior. |
| Vagas | 6,5 | 9 | 1 H1, rótulos ligados, sem "Remoto · Remoto". |
| Detalhe da vaga (público) | 6,5 | 8,5 | Uma ação primária; título próprio na aba. |
| Entrar / Cadastro | 7,5 | 9 | Erros em linha, mostrar senha. |
| Minhas candidaturas | 7 | 8,5 | Caixa de frase, sucesso com próximo passo. |
| Desafios (candidato) / Teste de código | 7 | 8,5 | Plural correto. (Código, sem render com dados.) |
| Meu perfil | 7 | 8 | "Compatibilidade" em todo texto; formulário segue longo. |
| Painel | 6,5 | 8,5 | Gargalo em destaque, KPIs compactos, vagas por atividade. |
| Minhas vagas | 6,5 | 8 | Alvos ≥ 24px; texto em caixa de frase. |
| Detalhe da vaga (recrutador) | 3 | 8 | Carrega; erro, se vier, tem causa e saída. |
| Candidaturas da vaga | 6 | 8,5 | H1 com o nome da vaga; cartão clicável inteiro; "na etapa há…". |
| Relatório do candidato | 6 | 9 | Faixa de decisão; etapa uma vez só; selo ao lado da etapa. |
| Busca de candidatos | 7 | 8 | Ícone real no vazio; erro com saída. |
| Catálogo de desafios | 5,5 | 8,5 | Cartões compactos, enunciado recolhível, filtros. |

### O que ainda impede o 10

1. **Dados de E2E na vitrine** (P-17, fora do escopo): "Vaga E2E 179…" e a vaga "x" (alvo de 9×24px, porque o título tem um caractere) ainda poluem `/vagas` e o painel.
2. **Desempenho percebido**: listas levam 3–5 s em dev; falta medir em build de produção.
3. **Tema escuro** (P-13): decisão de produto; exige tokens semânticos antes.
4. **LinkedIn** (P-12): só aparece com o provedor configurado; o `DESIGN.md` agora diz isso.
5. **Formulário do perfil** continua longo numa página só; dividir em etapas ou abas ajudaria.
6. **Não verificado**: hover/foco um a um, leitor de tela real e os gates automáticos do kit (`axe_audit`, `measure_render`), que só rodam com o plugin instalado.

### Veredito

**accept with minor fixes** (era *rework*). As telas têm foco, os erros ajudam e os textos seguem um padrão. O que falta para o 10 é limpeza de dados, medição em produção e duas decisões de produto, não retrabalho de design.

---

## Rodada 1

Data: 30/10/2026 · Base: `DESIGN.md` (v2) · Método: plugin `ux-ui-agent-skills` 3.0.0 (`design-doctrine`, `design-review` com 6 dimensões + Nielsen, `a11y-audit` WCAG 2.2 AA, `ux-writing`) e veredito do `design-critic`.

## Como foi feito (e o que ficou de fora)

- Telas abertas em http://localhost:3000 no navegador embutido, a 1280px e 375px, como recrutador (`recrutador@3aq.dev`) e como candidato novo criado em `/cadastro` (`design-review-…@example.test`).
- Em cada tela rodei um script no próprio navegador que mede o contraste de **todo** texto visível pela fórmula WCAG, alvos de toque menores que 24×24, campos sem rótulo associado, botões/links sem nome, estrutura de títulos e rolagem horizontal. Os números abaixo vêm dessa medição.
- **Não verificado:**
  - Os gates do kit (`measure_render`, `verify_states`, `axe_audit`, `slop_tells`) só aceitam arquivo HTML local e não rodam contra o app Next.js; não há número deles aqui.
  - **Tema escuro não existe** no app (nenhuma regra `dark:` ou `prefers-color-scheme: dark`), então não houve o que testar.
  - Durante a revisão, outra sessão trocou o login do navegador compartilhado para recrutador. Por isso **Minhas candidaturas (com dados), Desafios do candidato, a área do teste de código e Meu perfil** foram revisados **pelo código**, sem render. `/admin` não existe como rota separada; o admin usa as mesmas telas de `/recrutamento`.
  - Estados de hover/foco não foram medidos um a um.
- Os dados na tela são lixo de E2E ("Vaga E2E 1793…", vaga "x"). Julguei o design, não os dados; mas veja o item P-17.

## (a) Notas

Escala 0–10. Pesos do `design-review`: Hierarquia 20%, Consistência 20%, Acessibilidade 20%, Usabilidade 20%, Responsividade 10%, Desempenho 10%.

| Dimensão | Nota | Por quê |
|---|---|---|
| Hierarquia visual | 6,5 | Títulos em Outfit e cartões limpos, mas o relatório do candidato enterra a decisão no fim e o painel dá o mesmo peso a tudo. |
| Consistência | 6,5 | Paleta e componentes seguem o `DESIGN.md`; caixa dos títulos e nomes do menu variam; glifos (∅, !, ☰, ›, →) no lugar de ícones. |
| Acessibilidade | 7,5 | Contraste passou em todas as telas medidas, há link "Pular para o conteúdo", `lang="pt-BR"`, `role="alert"/"status"`. Falham título da página, rótulos da busca e alvos pequenos. |
| Usabilidade | 6,5 | Fluxos claros, mas erro genérico sem saída, CTAs duplicados na vaga e catálogo de desafios sem filtro. |
| Responsividade | 8 | Nada estoura a 375px; menu vira hambúrguer; cartões empilham bem. |
| Desempenho percebido | 6 | Listas levam 3–5 s em dev com esqueleto; detalhe da vaga do recrutador quebra (500). |
| **Geral (ponderado)** | **6,9** | Base sólida e fiel à marca; perde em acabamento, textos e estados de erro. |

### Nota por tela

| Tela | Rota | Desktop | 375px | Nota | Comentário curto |
|---|---|---|---|---|---|
| Início | `/` | visto | — | 7,5 | Hero forte e fiel à marca; H2/H3 vazios na árvore (títulos animados sem texto até o Reveal). |
| Vagas abertas | `/vagas` | visto | — | 6,5 | Dois `<h1>`, campos de busca sem rótulo ligado, "Remoto · Remoto". |
| Detalhe da vaga (público) | `/vagas/[id]` | visto | — | 6,5 | Duas ações competindo ("Enviar currículo" e "Candidatar-se"); título duplicado no breadcrumb e no H1. |
| Aviso de privacidade | `/privacidade` | código | — | 8 | Única tela com `<title>` próprio. |
| Entrar | `/entrar` | visto | — | 7,5 | Painel navy bem resolvido; falta o botão LinkedIn previsto no `DESIGN.md`; validação só com balão nativo do navegador. |
| Cadastro | `/cadastro` | visto | — | 7,5 | Ajuda "Mínimo de 8 caracteres" visível — bom. Mesmo ponto de validação. |
| Minhas candidaturas | `/candidaturas` | código | — | 7 | Estado vazio com valor + ação; título em Title Case. |
| Desafios (candidato) | `/desafios` | código | — | 7 | "caso(s) oculto(s)". |
| Teste de código | `/desafios/[id]` | código | — | — | Não renderizado; ver arquivo em uso pela outra sessão antes de mexer. |
| Meu perfil | `/perfil` | código | — | 7 | Textos explicam bem o "match"; formulário longo (528 linhas). |
| Painel do recrutador | `/recrutamento` | visto | visto | 6,5 | Três KPIs de peso igual; botão "Criar Vaga" em Title Case. |
| Minhas vagas | `/recrutamento/vagas` | visto | — | 6,5 | Lista correta; título do cartão é link de 21px de altura. |
| Detalhe da vaga (recrutador) | `/recrutamento/vagas/[id]` | visto | — | 3 | **Quebra**: API devolve 500 e a tela mostra "!" + "Não foi possível carregar a vaga." |
| Criar vaga | `/recrutamento/vagas/nova` | visto | — | 7 | Formulário claro. Arquivo `JobBuilder.tsx` está em edição por outra sessão. |
| Candidaturas da vaga | `/recrutamento/vagas/[id]/candidaturas` | visto | visto | 6 | Esqueleto bom; título "Candidatos" e breadcrumb "Vaga" não dizem qual vaga. "0% match". |
| Relatório do candidato | `…/candidaturas/[applicationId]` | visto | visto | 6 | "Etapa atual" repetida, decisão só no fim da página. |
| Busca de candidatos | `/recrutamento/candidatos` | visto | — | 7 | Estados vazio e "sem resultado" com orientação útil; ícone "∅". |
| Abrir candidato | `/recrutamento/candidatos/abrir` | visto | — | 7 | Sem parâmetro cai num 404 claro com saída "Ir para o painel". |
| Catálogo de desafios | `/recrutamento/desafios` | visto | — | 5,5 | Muro de texto: enunciados inteiros em todos os cartões, sem filtro nem recolher. |

## (b) Problemas priorizados

Gravidade: **Crítico** (impede tarefa) → **Alto** → **Médio** → **Baixo**.

| # | Grav. | Tela | O que está errado | WCAG / Nielsen | Arquivo provável | Correção sugerida |
|---|---|---|---|---|---|---|
| P-1 | Crítico | Detalhe da vaga (recrutador) e efeitos | `GET /api/recruiter/jobs/[id]` responde **500** para vagas publicadas e rascunhos. A tela vira "!" + "Não foi possível carregar a vaga."; nas candidaturas o breadcrumb vira "Vaga" e o relatório perde o StageTrail (por isso aparece "Etapa atual" duas vezes). | N1, N9 | `src/server/jobs/detail.ts` / `src/app/api/recruiter/jobs/[id]/route.ts` (talvez a migração `stage_email_template` ainda não aplicada) | Bug funcional, não de design: investigar o 500 primeiro. Pode vir da mudança em andamento do e-mail por etapa. |
| P-2 | Alto | Todas | `<title>` é sempre "CLTech \| Portal de Recrutamento" (só `/privacidade` tem o seu). Leitor de tela, abas e histórico não distinguem páginas. | 2.4.2 Página com título | `src/app/layout.tsx:12` + cada `page.tsx` | `title: { template: "%s — CLTech", default: "CLTech" }` no layout e `metadata`/`generateMetadata` em cada página ("Vagas abertas — CLTech", nome do candidato no relatório). |
| P-3 | Alto | Estado de erro (todas) | Erro mostra só "!" e "Não foi possível carregar X." + "Tentar de novo". Não diz o porquê nem oferece outra saída. | N9, ux-writing (o quê → por quê → como) | `src/components/ui/States.tsx` (ErrorState) | Ícone real, frase de causa provável ("O servidor não respondeu") e segunda ação ("Voltar para Minhas vagas"). |
| P-4 | Alto | Relatório do candidato | A decisão (Avançar/Reprovar) fica no fim da página, depois de cinco cartões; é a ação principal da tela. | N7, N8 — "uma coisa lidera" | `ApplicationDetailView.tsx` | Barra de decisão fixa no topo (ou lateral fixa no desktop) com etapa atual + Avançar/Reprovar; cartões de evidência abaixo. |
| P-5 | Alto | `/vagas` | Os campos "Cargo ou palavra-chave" e "Tecnologia" foram medidos **sem rótulo associado** (o `<Field id>` não chega ao `<input type="search">`). | 1.3.1, 4.1.2, 3.3.2 | `src/app/(public)/vagas/JobsList.tsx:162-166`, `src/components/ui/Field.tsx` | Passar o `id` ao input ou usar `aria-labelledby`. |
| P-6 | Alto | `/vagas` | Dois `<h1>` "Vagas abertas" na mesma página. | 1.3.1, 2.4.6 | `JobsList.tsx:151` + layout/página que também renderiza H1 | Um único H1 por página. |
| P-7 | Médio | Detalhe da vaga (público) | Duas ações de peso parecido: "Enviar currículo" (no meio do conteúdo) e "Candidatar-se" (lateral). Contraria "uma ação primária por área". | N4, N8, `DESIGN.md` | `src/app/(public)/vagas/[id]/JobDetail.tsx` | Manter só "Candidatar-se" como primário; o aviso de perfil vira link de texto. |
| P-8 | Médio | Candidaturas da vaga | Título "Candidatos" e breadcrumb "Vaga" não dizem **qual** vaga (piora com P-1). | N1, N6, 2.4.6 | `…/vagas/[id]/candidaturas/page.tsx` | H1 com o nome da vaga; "Candidatos" como subtítulo. |
| P-9 | Médio | Catálogo de desafios | Cada cartão mostra o enunciado inteiro, com exemplos; a página é um muro de texto. Sem busca, filtro de dificuldade ou linguagem. | N8, N7 | `src/app/(recruiter)/recrutamento/desafios/ChallengeCatalog.tsx` | Cartão com título, dificuldade, linguagens e 2 linhas de resumo; enunciado em `<details>` ou página própria; filtro por dificuldade. |
| P-10 | Médio | Todas (links em linha) | Alvos medidos abaixo de 24px de altura: "Pular para o conteúdo" 32×16, "Aviso de privacidade" 119×16, breadcrumb 40×20, títulos de cartão-link 21px, link "cv-valido.pdf" 18px, vaga "x" 10×24. | 2.5.8 Tamanho do alvo (mín.) | `Navigation.tsx` (Breadcrumb), `AppFooter`, cartões de vaga | Na maioria são links em texto (exceção do 2.5.8 se houver espaçamento); ainda assim, `py-1`/`min-h-6` no breadcrumb e no rodapé e tornar o cartão inteiro clicável. |
| P-11 | Médio | Login e cadastro | Validação só com o balão nativo do navegador ("Preencha este campo."); sem `aria-invalid`/`aria-describedby`; sem botão "mostrar senha". | 3.3.1, 3.3.8 (ajuda à autenticação) | `src/app/(auth)/entrar/LoginForm.tsx`, cadastro | Mensagem em linha abaixo do campo com `aria-describedby`, e alternar visibilidade da senha. |
| P-12 | Médio | Entrar / Cadastro | `DESIGN.md` prevê "Entrar com LinkedIn"; só aparece GitHub. | Consistência com o spec | `src/app/(auth)/…` | Mostrar o botão quando o provedor estiver configurado, ou atualizar o `DESIGN.md`. |
| P-13 | Médio | Todas | Sem tema escuro. Não é exigido pelo `DESIGN.md`, mas o pedido da revisão perguntava. | — | `globals.css`, `tailwind.config` | Decisão de produto; se vier, criar tokens semânticos antes. |
| P-14 | Baixo | Vagas (lista e card da home) | "Remoto · Remoto" quando localização e modalidade são iguais. | N8 | `JobsList.tsx:249`, `JobDetail.tsx`, `(public)/page.tsx:168` | Omitir a localização quando igual à modalidade. |
| P-15 | Baixo | Início | Vários `H2`/`H3` vazios na árvore de acessibilidade (conteúdo animado pelo Reveal/GSAP). | 1.3.1 | `src/components/home/HomeHero.tsx`, `FunnelLine.tsx` | Renderizar o texto no HTML e animar só opacidade/posição. |
| P-16 | Baixo | Painel | Três KPIs com o mesmo peso; o "Gargalo do funil" (o dado mais acionável) tem o mesmo tratamento dos contadores. A 375px os três ocupam a tela inteira. | N8 | `src/app/(recruiter)/recrutamento/page.tsx` | Destacar o gargalo com link para a etapa; KPIs em linha compacta no celular. |
| P-17 | Baixo | Todas | Base local cheia de dados de E2E ("Vaga E2E 1793…", "x", 9 "Candidato Busca") aparece na vitrine pública. | — | testes E2E / seed | Limpar dados de teste após a suíte ou isolar em banco próprio. |

### UX writing (textos)

| # | Onde | Hoje | Sugestão | Regra |
|---|---|---|---|---|
| W-1 | Menu candidato e títulos | "Vagas Disponíveis", "Minhas Candidaturas", "Desafios Técnicos", "Meu Perfil" | "Vagas", "Minhas candidaturas", "Desafios", "Meu perfil" | Caixa de frase; mesmo nome no menu e no H1 (hoje o menu diz "Vagas Disponíveis" e o H1 diz "Vagas abertas"). |
| W-2 | Recrutador | "Minhas Vagas", "Criar Vaga" | "Minhas vagas", "Criar vaga" | Caixa de frase. |
| W-3 | Catálogo / teste de código | "1 caso(s) visível(is)", "caso(s) oculto(s)" | Plural de verdade: "1 caso visível", "3 casos ocultos" | Sem concatenação; usar `Intl.PluralRules` ou ternário. `ChallengeWorkspace.tsx:291`, `ChallengeCatalog.tsx`. |
| W-4 | Listas | "0% match" | "0% de compatibilidade" (o relatório já usa "Compatibilidade") | Um termo só, em português. |
| W-5 | Lista de candidatos | "há menos de 1h na etapa" | "na etapa há menos de 1 hora" | Leitura natural. |
| W-6 | Sucesso | "Candidatura registrada com sucesso!" | "Candidatura enviada. Acompanhe aqui cada etapa." | Sem "com sucesso!"; diga o próximo passo. |
| W-7 | Erros | "Não foi possível carregar a vaga." | "Não conseguimos abrir esta vaga agora. Tente de novo em instantes ou volte para Minhas vagas." | O quê → por quê → como. |

## (c) Problemas que se repetem

1. **Glifos no lugar de ícones** — `∅` (vazio, `States.tsx:27`), `!` (erro), `☰`/`×` (menu, `AppHeader.tsx:171`), `›` (breadcrumb), `→` (etapas). Renderizam diferente em cada fonte e parecem provisórios. Trocar por um conjunto de ícones SVG único (ex.: `lucide-react`) num só lugar.
2. **`<title>` único** para o app inteiro (P-2).
3. **Caixa de título inconsistente** — Title Case em menus, H1 e botões convivendo com caixa de frase no resto (W-1, W-2).
4. **Estados de erro genéricos** — o mesmo `ErrorState` sem causa nem saída alternativa em todas as listas (P-3).
5. **Peso igual para tudo** — KPIs do painel, cartões do relatório e cartões do catálogo têm o mesmo tamanho e o mesmo tratamento; falta um foco por tela.
6. **Alvos pequenos em links de texto** — breadcrumb, rodapé e títulos-link dos cartões (P-10).
7. **Contraste: sem falhas.** O único item abaixo de 4,5:1 medido foi o separador `›` do breadcrumb (4,34:1, `text-ink-400`), que é decorativo e tem `aria-hidden`; não reprova. A paleta do `DESIGN.md` está cumprindo o que promete.
8. **Espaçamento e tipografia** estão coerentes: Outfit nos títulos, Plus Jakarta no texto, raio de cartão e botões em pílula iguais em todas as telas.

## (d) Pontos fortes a manter

- Paleta fiel ao `DESIGN.md`: azul royal só na ação, verde-água só no "passou", navy no acesso. Contraste aprovado em todas as telas medidas.
- Responsivo de verdade: nenhuma tela estourou a largura a 375px; cartões empilham e o menu recolhe.
- Base de acessibilidade já existe: "Pular para o conteúdo", `lang="pt-BR"`, breadcrumb com `aria-current`, `role="alert"` nos erros e `role="status"` nos avisos, StageTrail com `aria-current="step"`, `prefers-reduced-motion` respeitado nas animações GSAP.
- `SelectMenu` próprio em vez de `<select>` nativo, como pede a doutrina do kit.
- Esqueletos de carregamento no lugar de spinner.
- Estados vazios que ensinam: "Comece pela busca. Digite um nome, um e-mail ou uma tecnologia…" e "Tente um termo mais curto…".
- Textos honestos sobre a decisão: "A decisão é sempre humana — a nota automática nunca move o candidato de etapa."
- Diálogos de confirmação com título em pergunta ("Avançar candidato?", "Publicar esta vaga?").
- Tela de acesso com painel navy e proposta de valor clara.

## (e) Veredito do `design-critic`

**VERDICT: rework** (não reprovar, mas devolver para ajuste).

O critic trabalhou a partir das capturas e do código. Os scripts do kit não rodaram, pelo mesmo motivo dado acima.

- **Relatório do candidato sem ponto focal.** A tela existe para o recrutador decidir, mas Processo, Compatibilidade, Currículo, Contas e Teste aparecem como cartões brancos iguais. O "0%" é o único número grande e fica perdido num cartão secundário. Correção: uma faixa no topo com match, recomendação, etapa e ação primária, e os cartões passam a ser o detalhe (confirma o P-4).
- **"Etapa atual" duplicada** (`ApplicationDetailView.tsx:245` e `:254`). Isso passa uma impressão de descuido. Nota da revisão: a duplicação só aparece quando `stages` vem vazio, o que hoje acontece por causa do 500 do P-1. Ainda assim, o fallback não deveria repetir a `description`.
- **Grade de vagas do painel uniforme.** Uma vaga publicada com candidatos pesa o mesmo que um rascunho vazio. Correção: ordenar por atividade, deixar os rascunhos visualmente mais discretos e destacar o total de candidatos.
- Achados menores: o selo "Em andamento" fica solto ao lado do título do relatório; na home, o texto de apoio é pequeno demais perto do H1 (sugere 16–18px); o botão do Next dev cobre o rodapé a 375px (artefato do modo dev).
- **Pontos a manter, segundo o critic:** a home tem voz própria, e o mock do relatório mostra o produto em vez de só prometer. A lista de candidatos a 375px empilha limpa, com selos de palavra e cor.

## Resumo

O CLTech tem uma base boa: segue a identidade do `DESIGN.md`, o contraste passa em todas as telas medidas e nada quebra no celular. O que falta é acabamento: cada tela precisa de um foco claro, os erros precisam ajudar quem os vê e os textos precisam de padrão. Nota geral: **6,9/10**.

As 5 correções de maior impacto:

1. **Consertar o 500 do detalhe da vaga do recrutador (P-1).** É a origem da tela quebrada, do breadcrumb "Vaga" e da etapa repetida no relatório.
2. **Pôr a decisão no topo do relatório do candidato (P-4 + critic).** Uma faixa com compatibilidade, recomendação, etapa e os botões Avançar/Reprovar.
3. **Dar um `<title>` próprio a cada página (P-2)** e corrigir os rótulos e o H1 duplicado em `/vagas` (P-5, P-6).
4. **Reescrever o estado de erro (P-3)** com causa, ícone de verdade e uma segunda saída, e trocar os glifos (∅ ! ☰ ›) por ícones SVG.
5. **Padronizar os textos (W-1 a W-4):** caixa de frase, o mesmo nome no menu e no título, plural correto e "compatibilidade" no lugar de "match".
