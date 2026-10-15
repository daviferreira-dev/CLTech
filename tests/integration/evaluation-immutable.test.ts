// Teste obrigatório pela constituição (Princípio II, FR-028):
// UPDATE em "Evaluation" MUST falhar — ver prisma/migrations/
// 20260912000001_evaluation_immutability/migration.sql.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";

async function createEvaluationFixture() {
  const recruiter = await prisma.user.create({
    data: { name: "Recrutador", email: `rec-eval-${Date.now()}@example.com`, role: "RECRUITER" },
  });
  const job = await prisma.job.create({
    data: {
      title: "Vaga Avaliação",
      description: "—",
      company: "3aq",
      location: "Remoto",
      workMode: "REMOTE",
      seniority: "JUNIOR",
      technologies: [],
      minimumRequirements: "—",
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: recruiter.id,
      stages: { create: [{ type: "RESUME_ANALYSIS", order: 0, config: {} }] },
    },
    include: { stages: true },
  });

  const user = await registerCandidate({
    name: "Candidato Avaliação",
    email: `cand-eval-${Date.now()}@example.com`,
    password: "senhaSegura123",
  });
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
  const application = await prisma.application.create({
    data: {
      candidateId: candidate.id,
      jobId: job.id,
      resumeId: resume.id,
      currentStageId: job.stages[0]!.id,
    },
  });

  const evaluation = await prisma.evaluation.create({
    data: {
      applicationId: application.id,
      type: "RESUME_MATCH",
      score: 80,
      justification: { encontradas: ["TypeScript"], exigidas: ["TypeScript"] },
    },
  });

  return evaluation;
}

describe("Evaluation (Princípio II, FR-028)", () => {
  it("UPDATE direto via SQL é bloqueado pela trigger", async () => {
    const evaluation = await createEvaluationFixture();

    await expect(
      prisma.$executeRawUnsafe(`UPDATE "Evaluation" SET score = 100 WHERE id = $1`, evaluation.id),
    ).rejects.toThrow(/immutable/i);

    const unchanged = await prisma.evaluation.findUniqueOrThrow({ where: { id: evaluation.id } });
    expect(unchanged.score).toBe(80);
  });

  it("reprocessamento cria nova versão em vez de alterar a existente", async () => {
    const evaluation = await createEvaluationFixture();

    const reprocessed = await prisma.evaluation.create({
      data: {
        applicationId: evaluation.applicationId,
        type: evaluation.type,
        score: 90,
        justification: { encontradas: ["TypeScript", "Node.js"], exigidas: ["TypeScript"] },
        version: evaluation.version + 1,
      },
    });

    const original = await prisma.evaluation.findUniqueOrThrow({ where: { id: evaluation.id } });
    expect(original.score).toBe(80); // preservado

    const latest = await prisma.evaluation.findFirst({
      where: { applicationId: evaluation.applicationId, type: evaluation.type },
      orderBy: { version: "desc" },
    });
    expect(latest?.id).toBe(reprocessed.id);
    expect(latest?.score).toBe(90);
  });
});
