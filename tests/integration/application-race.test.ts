// Teste obrigatório pela constituição (FR-022, SC-003):
// duas candidaturas simultâneas do mesmo candidato à mesma vaga resultam em uma só.
// A garantia é o índice único no banco, não um SELECT prévio — por isso o teste
// dispara as duas chamadas em paralelo, não em sequência.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { applyToJob } from "@/server/applications/apply";
import { ApiError } from "@/lib/errors";

async function createPublishedJobWithStage() {
  const recruiter = await prisma.user.create({
    data: { name: "Recrutador Teste", email: `recrutador-${Date.now()}@example.com`, role: "RECRUITER" },
  });
  const job = await prisma.job.create({
    data: {
      title: "Vaga de Teste",
      description: "Descrição",
      company: "3aq",
      location: "Remoto",
      workMode: "REMOTE",
      seniority: "JUNIOR",
      technologies: ["TypeScript"],
      minimumRequirements: "TypeScript",
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: recruiter.id,
      stages: { create: [{ type: "RESUME_ANALYSIS", order: 0, config: {} }] },
    },
  });
  return job;
}

async function createCandidateWithResume(email: string) {
  const user = await registerCandidate({ name: "Candidato Teste", email, password: "senhaSegura123" });
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
  await prisma.resume.create({
    data: {
      candidateId: candidate.id,
      storageKey: `resumes/${candidate.id}/cv.pdf`,
      originalFilename: "cv.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      isCurrent: true,
    },
  });
  return user;
}

describe("applyToJob — candidatura simultânea (FR-022, SC-003)", () => {
  it("duas chamadas em paralelo resultam em uma única Application", async () => {
    const job = await createPublishedJobWithStage();
    const user = await createCandidateWithResume(`concorrencia-${Date.now()}@example.com`);

    const results = await Promise.allSettled([
      applyToJob(user.id, job.id),
      applyToJob(user.id, job.id),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ApiError);
    expect(((rejected[0] as PromiseRejectedResult).reason as ApiError).status).toBe(409);

    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
    const count = await prisma.application.count({ where: { candidateId: candidate.id, jobId: job.id } });
    expect(count).toBe(1);
  });

  it("recusa candidatura sem currículo vigente (FR-024)", async () => {
    const job = await createPublishedJobWithStage();
    const user = await registerCandidate({
      name: "Sem Currículo",
      email: `sem-cv-${Date.now()}@example.com`,
      password: "senhaSegura123",
    });

    await expect(applyToJob(user.id, job.id)).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).status).toBe(422);
      expect((err as ApiError).code).toBe("RESUME_REQUIRED");
      return true;
    });
  });

  it("recusa candidatura em vaga não publicada", async () => {
    const recruiter = await prisma.user.create({
      data: { name: "Recrutador", email: `recrutador2-${Date.now()}@example.com`, role: "RECRUITER" },
    });
    const draftJob = await prisma.job.create({
      data: {
        title: "Vaga Rascunho",
        description: "—",
        company: "3aq",
        location: "Remoto",
        workMode: "REMOTE",
        seniority: "JUNIOR",
        technologies: [],
        minimumRequirements: "—",
        status: "DRAFT",
        createdById: recruiter.id,
        stages: { create: [{ type: "RESUME_ANALYSIS", order: 0, config: {} }] },
      },
    });
    const user = await createCandidateWithResume(`draft-${Date.now()}@example.com`);

    await expect(applyToJob(user.id, draftJob.id)).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).code).toBe("JOB_NOT_OPEN");
      return true;
    });
  });
});
