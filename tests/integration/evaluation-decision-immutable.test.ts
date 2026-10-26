// Princípio II / FR-050: a rota de decisão nunca aceita nem grava score. O schema
// descarta qualquer campo de score enviado; a função de decisão nem tem parâmetro pra isso.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { applyToJob } from "@/server/applications/apply";
import { recordDecision } from "@/server/applications/decision";
import { recordDecisionSchema } from "@/lib/validation/applications";
import { encrypt } from "@/server/crypto";

// Entrevistas exigem data e link da reunião ao avançar para elas.
const MEETING = { scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), url: "https://meet.example.com/abc" };

async function createPublishedJobWithTwoStages() {
  const recruiter = await prisma.user.create({
    data: { name: "Recrutador Teste", email: `recrutador-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
  const job = await prisma.job.create({
    data: {
      title: "Vaga de Teste",
      description: "Descrição",
      company: "3aq",
      location: "Remoto",
      workMode: "REMOTE",
      seniority: "JUNIOR",
      technologies: ["React"],
      minimumRequirements: "React",
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: recruiter.id,
      stages: { create: [{ type: "RESUME_ANALYSIS", order: 0, config: {} }, { type: "TECH_INTERVIEW", order: 1, config: {} }] },
    },
  });
  return { job, recruiter };
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
      extractedText: encrypt("React no currículo."),
      parseStatus: "PARSED",
    },
  });
  return user;
}

describe("recordDecision nunca altera score (Princípio II, FR-050)", () => {
  it("schema de validação descarta qualquer campo de score enviado", () => {
    const parsed = recordDecisionSchema.safeParse({ decision: "ADVANCE", score: 100, matchScore: 999 });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ decision: "ADVANCE" });
  });

  it("avançar/reprovar não muda o score da Evaluation já gravada", async () => {
    const { job, recruiter } = await createPublishedJobWithTwoStages();
    const user = await createCandidateWithResume(`decisao-${Date.now()}@example.com`);
    const applied = await applyToJob(user.id, job.id);

    const before = await prisma.evaluation.findFirstOrThrow({ where: { applicationId: applied.applicationId } });
    expect(before.score).toBe(100);

    await recordDecision(applied.applicationId, recruiter.id, "ADVANCE", MEETING);

    const after = await prisma.evaluation.findFirstOrThrow({ where: { applicationId: applied.applicationId } });
    expect(after.score).toBe(100);
    expect(after.id).toBe(before.id); // mesma linha, não recriada

    await recordDecision(applied.applicationId, recruiter.id, "REJECT");
    const afterReject = await prisma.evaluation.findFirstOrThrow({ where: { applicationId: applied.applicationId } });
    expect(afterReject.score).toBe(100);
  });

  it("UPDATE direto em Evaluation continua bloqueado pela trigger (reforço com dado real desta sprint)", async () => {
    const { job } = await createPublishedJobWithTwoStages();
    const user = await createCandidateWithResume(`trigger-${Date.now()}@example.com`);
    const applied = await applyToJob(user.id, job.id);
    const evaluation = await prisma.evaluation.findFirstOrThrow({ where: { applicationId: applied.applicationId } });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE "Evaluation" SET score = 0 WHERE id = $1`, evaluation.id),
    ).rejects.toThrow();
  });
});
