import { describe, expect, it } from "vitest";
import { markdownBlocks } from "@/lib/markdown";

// Relatório E2E item 9: enunciado aparecia com crases e cercas literais.
describe("markdownBlocks", () => {
  it("separa parágrafos, código inline e bloco cercado", () => {
    const source = "Leia `N` inteiros.\n\nExemplo:\n```txt\n1 2\n3\n```\nSaída: `6`.";
    expect(markdownBlocks(source)).toEqual([
      {
        type: "paragraph",
        parts: [
          { code: false, text: "Leia " },
          { code: true, text: "N" },
          { code: false, text: " inteiros." },
        ],
      },
      { type: "paragraph", parts: [{ code: false, text: "Exemplo:" }] },
      { type: "code", text: "1 2\n3" },
      {
        type: "paragraph",
        parts: [
          { code: false, text: "Saída: " },
          { code: true, text: "6" },
          { code: false, text: "." },
        ],
      },
    ]);
  });

  it("devolve HTML como texto, sem interpretar", () => {
    expect(markdownBlocks("<img src=x onerror=alert(1)>")).toEqual([
      {
        type: "paragraph",
        parts: [{ code: false, text: "<img src=x onerror=alert(1)>" }],
      },
    ]);
  });
});
