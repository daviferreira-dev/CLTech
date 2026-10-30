// Teste obrigatório pela constituição (Princípio I / FR-017):
// candidato sem papel recrutador não acessa currículo de outro candidato.
import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { encrypt } from "@/server/crypto";
import { getResumeFile } from "@/server/candidates/resume-access";
import { ApiError } from "@/lib/errors";

// O bucket guarda o currículo como uploadResume grava: base64 do original, cifrado.
const ORIGINAL = Buffer.from("%PDF-1.4\nconteudo do curriculo");
vi.mock("@/server/storage", () => ({
  getPrivateObject: vi.fn(async () => Buffer.from(encrypt(ORIGINAL.toString("base64")), "utf8")),
}));

async function createCandidateWithResume(email: string) {
  const user = await registerCandidate({ name: "Teste", email, password: "senhaSegura123" });
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
  const resume = await prisma.resume.create({
    data: {
      candidateId: candidate.id,
      storageKey: `resumes/${candidate.id}/cv.pdf`,
      originalFilename: "cv.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      isCurrent: true,
    },
  });
  return { user, candidate, resume };
}

describe("getResumeFile (Princípio I, FR-017)", () => {
  it("permite que o próprio candidato baixe seu currículo, decifrado", async () => {
    const { user, resume } = await createCandidateWithResume("dono@example.com");
    const file = await getResumeFile({ id: user.id, role: "CANDIDATE" }, resume.id);
    // Regressão: antes o download entregava o conteúdo ainda cifrado do bucket.
    expect(file.content.equals(ORIGINAL)).toBe(true);
    expect(file).toMatchObject({ filename: "cv.pdf", mimeType: "application/pdf" });
  });

  it("recusa outro candidato (403) — não pode ler currículo alheio", async () => {
    const { resume } = await createCandidateWithResume("vitima@example.com");
    const { user: attacker } = await createCandidateWithResume("atacante@example.com");

    await expect(
      getResumeFile({ id: attacker.id, role: "CANDIDATE" }, resume.id),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      return true;
    });
  });

  it("permite RECRUITER e ADMIN, mesmo sem ser o dono", async () => {
    const { resume } = await createCandidateWithResume("outra-vitima@example.com");

    await expect(
      getResumeFile({ id: "recruiter-id", role: "RECRUITER" }, resume.id),
    ).resolves.toMatchObject({ filename: "cv.pdf" });

    await expect(
      getResumeFile({ id: "admin-id", role: "ADMIN" }, resume.id),
    ).resolves.toMatchObject({ filename: "cv.pdf" });
  });

  it("404 para currículo inexistente", async () => {
    await expect(
      getResumeFile({ id: "qualquer", role: "ADMIN" }, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).status).toBe(404);
      return true;
    });
  });
});
