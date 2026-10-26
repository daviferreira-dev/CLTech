// Aprovar um candidato na última etapa preenche a vaga: ela é encerrada e quem ainda
// estava em andamento nela é reprovado, na mesma transação.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { applyToJob } from "@/server/applications/apply";
import { recordDecision } from "@/server/applications/decision";
import { encrypt } from "@/server/crypto";

async function createPublishedJob() {
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

describe("aprovação final encerra a vaga", () => {
  it("fecha a vaga e reprova os demais candidatos em andamento", async () => {
    const { job, recruiter } = await createPublishedJob();
    const suffix = `${Date.now()}-${Math.random()}`;
    const winner = await applyToJob((await createCandidateWithResume(`vencedor-${suffix}@example.com`)).id, job.id);
    const other = await applyToJob((await createCandidateWithResume(`outro-${suffix}@example.com`)).id, job.id);
    const alreadyRejected = await applyToJob((await createCandidateWithResume(`reprovado-${suffix}@example.com`)).id, job.id);
    await recordDecision(alreadyRejected.applicationId, recruiter.id, "REJECT");

    await recordDecision(winner.applicationId, recruiter.id, "ADVANCE");
    const result = await recordDecision(winner.applicationId, recruiter.id, "ADVANCE");
    expect(result.status).toBe("APPROVED");

    expect((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("CLOSED");
    expect((await prisma.application.findUniqueOrThrow({ where: { id: other.applicationId } })).status).toBe("REJECTED");
    expect((await prisma.application.findUniqueOrThrow({ where: { id: alreadyRejected.applicationId } })).status).toBe("REJECTED");

    const openHistory = await prisma.applicationStageHistory.count({
      where: { application: { jobId: job.id }, exitedAt: null },
    });
    expect(openHistory).toBe(0);

    await expect(recordDecision(other.applicationId, recruiter.id, "ADVANCE")).rejects.toMatchObject({ code: "APPLICATION_CLOSED" });
  });

  it("não aprova um segundo candidato numa vaga já encerrada", async () => {
    const { job, recruiter } = await createPublishedJob();
    const suffix = `${Date.now()}-${Math.random()}`;
    const first = await applyToJob((await createCandidateWithResume(`primeiro-${suffix}@example.com`)).id, job.id);
    const second = await applyToJob((await createCandidateWithResume(`segundo-${suffix}@example.com`)).id, job.id);
    await recordDecision(first.applicationId, recruiter.id, "ADVANCE");
    await recordDecision(second.applicationId, recruiter.id, "ADVANCE");

    const results = await Promise.allSettled([
      recordDecision(first.applicationId, recruiter.id, "ADVANCE"),
      recordDecision(second.applicationId, recruiter.id, "ADVANCE"),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const approved = await prisma.application.count({ where: { jobId: job.id, status: "APPROVED" } });
    expect(approved).toBe(1);
  });
});
