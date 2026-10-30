import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { LocalSandbox } from "@/server/sandbox";

// Relatório E2E item 10: o stderr mostrava o caminho temporário do servidor.
describe("LocalSandbox", () => {
  it("tira o diretório temporário do diagnóstico", async () => {
    const result = await new LocalSandbox().run({
      language: "javascript",
      sourceCode: 'throw new Error("boom")',
      stdin: "",
      timeLimitSeconds: 5,
    });
    expect(result.outcome).toBe("RUNTIME_ERROR");
    expect(result.diagnostics).toContain("main.js:1");
    expect(result.diagnostics).not.toContain(tmpdir());
    expect(result.diagnostics).not.toContain("cltech-sandbox-");
  });
});
