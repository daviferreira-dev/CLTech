// Teste obrigatório pela constituição (Princípio I / FR-017):
// candidato sem papel recrutador não acessa currículo de outro candidato.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { getResumeDownloadUrl } from "@/server/candidates/resume-access";
import { ApiError } from "@/lib/errors";

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

describe("getResumeDownloadUrl (Princípio I, FR-017)", () => {
  it("permite que o próprio candidato baixe seu currículo", async () => {
    const { user, resume } = await createCandidateWithResume("dono@example.com");
    await expect(
      getResumeDownloadUrl({ id: user.id, role: "CANDIDATE" }, resume.id),
    ).resolves.toEqual(expect.any(String));
  });

  it("recusa outro candidato (403) — não pode ler currículo alheio", async () => {
    const { resume } = await createCandidateWithResume("vitima@example.com");
    const { user: attacker } = await createCandidateWithResume("atacante@example.com");

    await expect(
      getResumeDownloadUrl({ id: attacker.id, role: "CANDIDATE" }, resume.id),
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(403);
      return true;
    });
  });

  it("permite RECRUITER e ADMIN, mesmo sem ser o dono", async () => {
    const { resume } = await createCandidateWithResume("outra-vitima@example.com");

    await expect(
      getResumeDownloadUrl({ id: "recruiter-id", role: "RECRUITER" }, resume.id),
    ).resolves.toEqual(expect.any(String));

    await expect(
      getResumeDownloadUrl({ id: "admin-id", role: "ADMIN" }, resume.id),
    ).resolves.toEqual(expect.any(String));
  });

  it("404 para currículo inexistente", async () => {
    await expect(
      getResumeDownloadUrl({ id: "qualquer", role: "ADMIN" }, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).status).toBe(404);
      return true;
    });
  });
});
