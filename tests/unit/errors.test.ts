import { describe, expect, it } from "vitest";
import { Errors, toErrorResponse } from "@/lib/errors";

describe("erros da API", () => {
  // Relatório E2E item 8: `await req.json()` com corpo malformado virava 500.
  it("JSON inválido no corpo vira 400 VALIDATION_ERROR", async () => {
    const parseError = await new Request("http://x", { method: "POST", body: "{bad" }).json().catch((err: unknown) => err);
    const response = toErrorResponse(parseError);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  // Item 11: concordância de gênero.
  it("notFound concorda o particípio", () => {
    expect(Errors.notFound("Vaga", true).message).toBe("Vaga não encontrada.");
    expect(Errors.notFound("Perfil").message).toBe("Perfil não encontrado.");
  });
});
