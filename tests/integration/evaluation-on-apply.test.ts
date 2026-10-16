// Princípio III: nenhuma Application existe sem Evaluation(RESUME_MATCH) junto, na
// mesma transação de applyToJob — mesmo quando o candidato não tem nenhum sinal.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { applyToJob } from "@/server/applications/apply";
import { encrypt } from "@/server/crypto";

async function createPublishedJob(technologies: string[], stages: Array<"RESUME_ANALYSIS" | "GITHUB_ANALYSIS"> = ["RESUME_ANALYSIS"]) {
  const recruiter = await prisma.user.create({
    data: { name: "Recrutador Teste", email: `recrutador-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
  return prisma.job.create({
    data: {
      title: "Vaga de Teste",
      description: "Descrição",
      company: "3aq",
      location: "Remoto",
      workMode: "REMOTE",
      seniority: "JUNIOR",
      technologies,
      minimumRequirements: technologies.join(", "),
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: recruiter.id,
      stages: { create: stages.map((type, order) => ({ type, order, config: {} })) },
    },
  });
}

async function createCandidate(email: string, extractedText: string | null) {
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
      extractedText: extractedText ? encrypt(extractedText) : null,
      parseStatus: extractedText ? "PARSED" : "FAILED",
    },
  });
  return user;
}

describe("applyToJob gera Evaluation (Princípio III)", () => {
  it("cria Evaluation(RESUME_MATCH) com sinal de currículo", async () => {
    const job = await createPublishedJob(["React", "Node"]);
    const user = await createCandidate(`com-sinal-${Date.now()}@example.com`, "Experiência com React.");

    const result = await applyToJob(user.id, job.id);

    const evaluations = await prisma.evaluation.findMany({ where: { applicationId: result.applicationId } });
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]?.type).toBe("RESUME_MATCH");
    expect(evaluations[0]?.score).toBe(50);
    expect(result.matchScoreStatus).toBe("CALCULATED");
  });

  it("cria Evaluation(RESUME_MATCH) com score 0 quando não há nenhum sinal — nunca omite a avaliação", async () => {
    const job = await createPublishedJob(["React"]);
    // extração falhou (PDF ilegível) e não há GitHub conectado.
    const user = await createCandidate(`sem-sinal-${Date.now()}@example.com`, null);

    const result = await applyToJob(user.id, job.id);

    const evaluations = await prisma.evaluation.findMany({ where: { applicationId: result.applicationId } });
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]?.score).toBe(0);
    expect(evaluations[0]?.justification).toEqual({ matched: [], missing: ["React"] });
  });

  it("cria também Evaluation(GITHUB_ANALYSIS) quando o pipeline tem essa etapa e há GitHub sincronizado", async () => {
    const job = await createPublishedJob(["React", "Go"], ["RESUME_ANALYSIS", "GITHUB_ANALYSIS"]);
    const user = await createCandidate(`com-github-${Date.now()}@example.com`, "React no currículo.");
    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
    await prisma.githubProfile.create({
      data: {
        candidateId: candidate.id,
        publicRepoCount: 3,
        languages: [{ name: "Go", bytes: 1000, share: 1 }],
        activityLast90Days: 5,
        followers: 1,
        collectedAt: new Date(),
      },
    });

    const result = await applyToJob(user.id, job.id);

    const evaluations = await prisma.evaluation.findMany({ where: { applicationId: result.applicationId } });
    expect(evaluations.map((e) => e.type).sort()).toEqual(["GITHUB_ANALYSIS", "RESUME_MATCH"]);
    const githubEval = evaluations.find((e) => e.type === "GITHUB_ANALYSIS");
    expect(githubEval?.score).toBe(50); // só Go bate, de 2 tecnologias
  });

  it("não cria Evaluation(GITHUB_ANALYSIS) quando o pipeline não tem essa etapa, mesmo com GitHub conectado", async () => {
    const job = await createPublishedJob(["Go"], ["RESUME_ANALYSIS"]);
    const user = await createCandidate(`sem-etapa-github-${Date.now()}@example.com`, "Nada de Go aqui.");
    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
    await prisma.githubProfile.create({
      data: {
        candidateId: candidate.id,
        publicRepoCount: 1,
        languages: [{ name: "Go", bytes: 1000, share: 1 }],
        activityLast90Days: 1,
        followers: 0,
        collectedAt: new Date(),
      },
    });

    const result = await applyToJob(user.id, job.id);
    const evaluations = await prisma.evaluation.findMany({ where: { applicationId: result.applicationId } });
    expect(evaluations.map((e) => e.type)).toEqual(["RESUME_MATCH"]);
  });
});
