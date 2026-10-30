import { describe, expect, it } from "vitest";
import { jobPlace } from "@/lib/labels";
import { casesLabel } from "@/lib/codeTest";

describe("textos de vaga e desafio", () => {
  it("não repete a modalidade quando a localização é igual a ela", () => {
    expect(jobPlace("Remoto", "REMOTE")).toBe("Remoto");
    expect(jobPlace("São Paulo", "HYBRID")).toBe("São Paulo · Híbrido");
  });

  it("usa plural de verdade nos casos de teste", () => {
    expect(casesLabel(1, "visible")).toBe("1 caso visível");
    expect(casesLabel(3, "hidden")).toBe("3 casos ocultos");
    expect(casesLabel(0, "hidden")).toBe("0 casos ocultos");
  });
});
