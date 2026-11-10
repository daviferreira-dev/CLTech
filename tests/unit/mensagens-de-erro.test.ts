import { describe, expect, it } from "vitest";
import { toErrorResponse } from "@/lib/errors";
import { updateProfileSchema } from "@/lib/validation/profile";
import { z } from "zod";

// Spec de UX writing: toda mensagem de erro é clara, específica, útil e humana, em português.
function firstMessage(body: unknown): string {
  const r = updateProfileSchema.safeParse(body);
  if (r.success) throw new Error("devia falhar");
  return r.error.issues[0]!.message;
}

describe("mensagens de erro em português", () => {
  it("telefone curto diz o que fazer", () => {
    expect(firstMessage({ phone: "123" })).toBe("O telefone parece curto demais. Informe com DDD, por exemplo (85) 99999-0000.");
  });

  it("estado com uma letra pede a sigla", () => {
    expect(firstMessage({ state: "C" })).toBe("Use a sigla do estado, com 2 letras. Exemplo: CE.");
  });

  it("nome vazio e cidade longa têm texto próprio", () => {
    expect(firstMessage({ name: "" })).toBe("Informe seu nome.");
    expect(firstMessage({ city: "x".repeat(101) })).toBe("A cidade pode ter no máximo 100 caracteres.");
  });

  it("o texto padrão do Zod, onde não há mensagem própria, também sai em português", () => {
    const r = z.string().uuid().safeParse("x");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.message).not.toMatch(/Invalid|Too (small|big)|expected/);
  });

  it("erro interno não diz só 'tente novamente': orienta e não culpa a pessoa", async () => {
    const res = toErrorResponse(new Error("boom"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Algo deu errado do nosso lado. Tente de novo em instantes; se continuar, avise a equipe da 3aq.");
  });
});
