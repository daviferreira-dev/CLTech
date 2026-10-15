// User Story 1 — ver quickstart.md "Fluxo 1" e spec.md Acceptance Scenarios 1-4.
import { describe, it, expect } from "vitest";
import * as argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { destinationForRole } from "@/server/auth/redirect";
import { ApiError } from "@/lib/errors";

describe("registerCandidate (FR-001, FR-004, FR-007)", () => {
  it("cria conta com papel CANDIDATE e senha em hash irreversível", async () => {
    const user = await registerCandidate({
      name: "Ana Teste",
      email: "ana@example.com",
      password: "senhaSegura123",
    });

    expect(user.role).toBe("CANDIDATE");

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).not.toBe("senhaSegura123");
    expect(await argon2.verify(stored.passwordHash!, "senhaSegura123")).toBe(true);
  });

  it("cria o Candidate 1:1 junto com o User", async () => {
    const user = await registerCandidate({
      name: "Bruno Teste",
      email: "bruno@example.com",
      password: "senhaSegura123",
    });

    const candidate = await prisma.candidate.findUnique({ where: { userId: user.id } });
    expect(candidate).not.toBeNull();
  });

  it("normaliza o e-mail para minúsculas", async () => {
    const user = await registerCandidate({
      name: "Carla Teste",
      email: "Carla@Example.COM",
      password: "senhaSegura123",
    });
    expect(user.email).toBe("carla@example.com");
  });

  it("recusa e-mail duplicado com mensagem genérica, sem revelar a existência da conta", async () => {
    await registerCandidate({
      name: "Duda Teste",
      email: "duda@example.com",
      password: "senhaSegura123",
    });

    await expect(
      registerCandidate({
        name: "Duda Segunda Tentativa",
        email: "duda@example.com",
        password: "outraSenha123",
      }),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.message.toLowerCase()).not.toContain("já cadastrado");
      return true;
    });
  });
});

describe("destinationForRole (FR-006)", () => {
  it("leva CANDIDATE para /vagas", () => {
    expect(destinationForRole("CANDIDATE")).toBe("/vagas");
  });

  it("leva RECRUITER e ADMIN para /recrutamento", () => {
    expect(destinationForRole("RECRUITER")).toBe("/recrutamento");
    expect(destinationForRole("ADMIN")).toBe("/recrutamento");
  });
});
