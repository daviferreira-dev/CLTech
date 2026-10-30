// Subconjunto de Markdown dos enunciados de desafio: parágrafos, `código inline` e blocos
// ``` cercados. Devolve só texto em estrutura; quem renderiza é o React, que escapa tudo
// (nada de HTML vindo do enunciado). ponytail: sem listas/negrito/links; trocar por uma
// biblioteca de Markdown se os enunciados passarem a usar isso.

export type InlinePart = { code: boolean; text: string };
export type MarkdownBlock =
  { type: "code"; text: string } | { type: "paragraph"; parts: InlinePart[] };

function inline(text: string): InlinePart[] {
  // split com grupo de captura: índices ímpares são o conteúdo entre crases.
  return text
    .split(/`([^`\n]+)`/)
    .map((part, i) => ({ code: i % 2 === 1, text: part }))
    .filter((part) => part.text !== "");
}

export function markdownBlocks(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  // Índices ímpares do split são o miolo de um bloco ``` (a linha da cerca, com a
  // linguagem opcional, fica fora). Cerca sem fechamento vira texto comum.
  source
    .replace(/\r\n/g, "\n")
    .split(/^```[^\n]*\n([\s\S]*?)^```[ \t]*$/m)
    .forEach((chunk, i) => {
      if (i % 2 === 1) {
        blocks.push({ type: "code", text: chunk.replace(/\n$/, "") });
        return;
      }
      for (const paragraph of chunk.split(/\n\s*\n/)) {
        const text = paragraph.trim();
        if (text) blocks.push({ type: "paragraph", parts: inline(text) });
      }
    });
  return blocks;
}
