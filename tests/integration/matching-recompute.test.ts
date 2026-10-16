// FR-034: recálculo de JobMatch nos gatilhos (currículo novo, GitHub sincronizado),
// nunca no caminho de leitura de GET /api/jobs (D3 da Sprint 1).
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { encrypt } from "@/server/crypto";
import { recomputeJobMatchesForCandidate, recomputeJobMatchesForJob } from "@/server/matching/recompute";
import { listPublishedJobs } from "@/server/jobs/list";

async function createPublishedJob(technologies: string[]) {
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
      stages: { create: [{ type: "RESUME_ANALYSIS", order: 0, config: {} }] },
    },
  });
}

async function createCandidateWithResume(email: string, extractedText: string) {
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
      extractedText: encrypt(extractedText),
      parseStatus: "PARSED",
    },
  });
  return { user, candidate };
}

describe("recomputeJobMatchesForCandidate (FR-034, gatilho 1-2)", () => {
  it("cria JobMatch com score e justificativa para toda vaga publicada", async () => {
    const job = await createPublishedJob(["React", "Node", "Docker"]);
    const { candidate } = await createCandidateWithResume(
      `match-${Date.now()}@example.com`,
      "Experiência com React e Node.",
    );

    await recomputeJobMatchesForCandidate(candidate.id);

    const match = await prisma.jobMatch.findUnique({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });
    expect(match).not.toBeNull();
    expect(match?.score).toBe(67); // só currículo, 2/3 tecnologias
    expect(match?.justification).toEqual({ matched: ["React", "Node"], missing: ["Docker"] });
  });

  it("não cria JobMatch quando o candidato não tem currículo vigente nem GitHub", async () => {
    const job = await createPublishedJob(["React"]);
    const user = await registerCandidate({ name: "Sem Currículo", email: `semcv-${Date.now()}@example.com`, password: "senhaSegura123" });
    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });

    await recomputeJobMatchesForCandidate(candidate.id);

    const match = await prisma.jobMatch.findUnique({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });
    expect(match).toBeNull();
    void job;
  });

  it("recalcula (não duplica) quando chamado de novo após o currículo mudar", async () => {
    const job = await createPublishedJob(["React", "Vue"]);
    const { candidate } = await createCandidateWithResume(`recalc-${Date.now()}@example.com`, "Só React.");
    await recomputeJobMatchesForCandidate(candidate.id);

    const before = await prisma.jobMatch.findUniqueOrThrow({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });
    expect(before.score).toBe(50);

    await prisma.resume.updateMany({ where: { candidateId: candidate.id }, data: { isCurrent: false } });
    await prisma.resume.create({
      data: {
        candidateId: candidate.id,
        storageKey: `resumes/${candidate.id}/cv2.pdf`,
        originalFilename: "cv2.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        isCurrent: true,
        extractedText: encrypt("React e Vue, as duas."),
        parseStatus: "PARSED",
      },
    });

    await recomputeJobMatchesForCandidate(candidate.id);

    const after = await prisma.jobMatch.findUniqueOrThrow({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });
    expect(after.score).toBe(100);
    expect(await prisma.jobMatch.count({ where: { candidateId: candidate.id, jobId: job.id } })).toBe(1);
  });
});

describe("recomputeJobMatchesForJob (FR-034, gatilho 3)", () => {
  it("cria JobMatch para todo candidato com currículo vigente", async () => {
    const { candidate: c1 } = await createCandidateWithResume(`c1-${Date.now()}@example.com`, "React.");
    const { candidate: c2 } = await createCandidateWithResume(`c2-${Date.now()}@example.com`, "Nada relevante aqui.");
    const job = await createPublishedJob(["React"]);

    await recomputeJobMatchesForJob(job.id);

    const matches = await prisma.jobMatch.findMany({ where: { jobId: job.id } });
    expect(matches).toHaveLength(2);
    expect(matches.find((m) => m.candidateId === c1.id)?.score).toBe(100);
    expect(matches.find((m) => m.candidateId === c2.id)?.score).toBe(0);
  });
});

describe("GET /api/jobs não recalcula no caminho de leitura (D3 da Sprint 1)", () => {
  it("leitura repetida da listagem não cria nem altera JobMatch", async () => {
    const job = await createPublishedJob(["React"]);
    const { user, candidate } = await createCandidateWithResume(`leitura-${Date.now()}@example.com`, "React.");
    await recomputeJobMatchesForCandidate(candidate.id);

    const before = await prisma.jobMatch.findUniqueOrThrow({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });

    await listPublishedJobs({ page: 1, pageSize: 20 }, user.id);
    await listPublishedJobs({ page: 1, pageSize: 20 }, user.id);

    const after = await prisma.jobMatch.findUniqueOrThrow({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });
    expect(after.computedAt).toEqual(before.computedAt);
  });
});
