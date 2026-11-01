// Visão macro das vagas (RH): agregação por vaga — mini-funil, gargalo, conversão,
// teste de código pendente/enviado, contratações e tempo médio até contratar.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { getJobsOverview } from "@/server/jobs/overview";
import type { JobStatus } from "@prisma/client";

const DAY = 86_400_000;
const HOUR = 3_600_000;

async function createRecruiter(name = "Recrutador Teste") {
  return prisma.user.create({
    data: { name, email: `recrutador-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
}

async function createCandidate(email: string) {
  const user = await prisma.user.create({ data: { name: "Candidato Teste", email, role: "CANDIDATE" } });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  const resume = await prisma.resume.create({
    data: {
      candidateId: candidate.id,
      storageKey: `resumes/${candidate.id}/cv.pdf`,
      originalFilename: "cv.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    },
  });
  return { candidateId: candidate.id, resumeId: resume.id };
}

async function createJob(
  createdById: string,
  overrides: { status?: JobStatus; publishedAt?: Date; title?: string } = {},
) {
  return prisma.job.create({
    data: {
      title: overrides.title ?? "Vaga de Teste",
      description: "Descrição",
      company: "3aq",
      location: "Remoto",
      workMode: "REMOTE",
      seniority: "JUNIOR",
      technologies: ["TypeScript"],
      minimumRequirements: "TypeScript",
      status: overrides.status ?? "PUBLISHED",
      publishedAt: overrides.publishedAt,
      createdById,
    },
  });
}

describe("getJobsOverview (visão macro das vagas)", () => {
  it("agrega mini-funil, gargalo, conversão, teste de código e posições de uma vaga", async () => {
    const recruiter = await createRecruiter();
    const publishedAt = new Date(Date.now() - 10 * DAY);
    const job = await createJob(recruiter.id, { publishedAt });

    const stageResume = await prisma.processStage.create({ data: { jobId: job.id, type: "RESUME_ANALYSIS", order: 0, config: {} } });
    const stageCode = await prisma.processStage.create({ data: { jobId: job.id, type: "CODE_TEST", order: 1, config: {} } });
    const stageHr = await prisma.processStage.create({ data: { jobId: job.id, type: "HR_INTERVIEW", order: 2, config: {} } });
    const stageFinal = await prisma.processStage.create({
      data: { jobId: job.id, type: "FINAL_OFFER", order: 3, config: { positions: 1 } },
    });

    // Em andamento, na Análise de Currículo há 2 horas.
    const c1 = await createCandidate(`c1-${Date.now()}@example.com`);
    const app1 = await prisma.application.create({
      data: { candidateId: c1.candidateId, jobId: job.id, resumeId: c1.resumeId, currentStageId: stageResume.id, status: "IN_PROGRESS" },
    });
    await prisma.applicationStageHistory.create({ data: { applicationId: app1.id, stageId: stageResume.id, enteredAt: new Date(Date.now() - 2 * HOUR) } });

    // Em andamento, no Teste de Código há 5 horas, sem enviar — é o gargalo (2 pessoas).
    const c2 = await createCandidate(`c2-${Date.now()}@example.com`);
    const app2 = await prisma.application.create({
      data: { candidateId: c2.candidateId, jobId: job.id, resumeId: c2.resumeId, currentStageId: stageCode.id, status: "IN_PROGRESS" },
    });
    await prisma.applicationStageHistory.create({ data: { applicationId: app2.id, stageId: stageCode.id, enteredAt: new Date(Date.now() - 5 * HOUR) } });

    // Em andamento, no Teste de Código há 7 horas, já enviou.
    const c3 = await createCandidate(`c3-${Date.now()}@example.com`);
    const app3 = await prisma.application.create({
      data: { candidateId: c3.candidateId, jobId: job.id, resumeId: c3.resumeId, currentStageId: stageCode.id, status: "IN_PROGRESS" },
    });
    await prisma.applicationStageHistory.create({ data: { applicationId: app3.id, stageId: stageCode.id, enteredAt: new Date(Date.now() - 7 * HOUR) } });
    const challenge = await prisma.challenge.create({
      data: { title: "Desafio", statement: "Resolva", languages: ["JAVASCRIPT"], difficulty: "EASY", testCases: [] },
    });
    await prisma.codeSubmission.create({ data: { applicationId: app3.id, challengeId: challenge.id, language: "JAVASCRIPT", sourceCode: "// ok" } });

    // Em andamento, na Entrevista de RH — aguardando decisão do recrutador.
    const c4 = await createCandidate(`c4-${Date.now()}@example.com`);
    const app4 = await prisma.application.create({
      data: { candidateId: c4.candidateId, jobId: job.id, resumeId: c4.resumeId, currentStageId: stageHr.id, status: "IN_PROGRESS" },
    });
    await prisma.applicationStageHistory.create({ data: { applicationId: app4.id, stageId: stageHr.id, enteredAt: new Date(Date.now() - HOUR) } });

    // Reprovado na Análise de Currículo.
    const c5 = await createCandidate(`c5-${Date.now()}@example.com`);
    const app5 = await prisma.application.create({
      data: { candidateId: c5.candidateId, jobId: job.id, resumeId: c5.resumeId, currentStageId: stageResume.id, status: "REJECTED" },
    });
    await prisma.applicationStageHistory.create({
      data: { applicationId: app5.id, stageId: stageResume.id, enteredAt: new Date(Date.now() - 3 * DAY), exitedAt: new Date(Date.now() - 2 * DAY) },
    });

    // Contratado: candidatou há 6 dias, aprovado (contratado) há 1 dia.
    const c6 = await createCandidate(`c6-${Date.now()}@example.com`);
    const appliedAt6 = new Date(Date.now() - 6 * DAY);
    const hiredAt6 = new Date(Date.now() - 1 * DAY);
    const app6 = await prisma.application.create({
      data: {
        candidateId: c6.candidateId,
        jobId: job.id,
        resumeId: c6.resumeId,
        currentStageId: stageFinal.id,
        status: "APPROVED",
        appliedAt: appliedAt6,
      },
    });
    await prisma.applicationStageHistory.create({
      data: { applicationId: app6.id, stageId: stageFinal.id, enteredAt: new Date(Date.now() - 2 * DAY), exitedAt: hiredAt6 },
    });

    const result = await getJobsOverview({});
    const row = result.jobs.find((j) => j.id === job.id);
    if (!row) throw new Error("vaga não apareceu na visão geral");

    expect(row.totalCandidates).toBe(6);
    expect(row.byStage).toEqual(
      expect.arrayContaining([
        { stageType: "RESUME_ANALYSIS", count: 1 },
        { stageType: "CODE_TEST", count: 2 },
        { stageType: "HR_INTERVIEW", count: 1 },
        { stageType: "FINAL_OFFER", count: 0 },
      ]),
    );
    expect(row.approvedCount).toBe(1);
    expect(row.rejectedCount).toBe(1);
    expect(row.conversionRate).toBe(0.5); // 1 aprovado / (1 aprovado + 1 reprovado)
    expect(row.bottleneck?.stageType).toBe("CODE_TEST");
    expect(row.bottleneck?.count).toBe(2);
    expect(row.codeTestPending).toBe(1);
    expect(row.codeTestSubmitted).toBe(1);
    expect(row.awaitingDecision).toBe(3); // 4 em andamento - 1 ainda sem enviar o teste
    expect(row.positionsFilled).toBe(1);
    expect(row.positionsTotal).toBe(1);
    expect(row.daysOpen).toBe(10);

    expect(result.summary.openJobs).toBe(1);
    expect(result.summary.activeCandidates).toBe(4);
    expect(result.summary.awaitingDecision).toBe(3);
    expect(result.summary.hiresInPeriod).toBe(1);
    expect(result.summary.avgDaysToHire).toBe(5); // contratado 6 dias (aplicou) - 1 dia (contratado) = 5
  });

  it("filtra por status, recrutador responsável e busca por título", async () => {
    const recruiterA = await createRecruiter("Recrutador A");
    const recruiterB = await createRecruiter("Recrutador B");
    const draft = await createJob(recruiterA.id, { status: "DRAFT", title: "Vaga Rascunho A" });
    const published = await createJob(recruiterA.id, { status: "PUBLISHED", publishedAt: new Date(), title: "Vaga React Publicada" });
    const fromB = await createJob(recruiterB.id, { status: "PUBLISHED", publishedAt: new Date(), title: "Vaga do Recrutador B" });

    const onlyPublished = await getJobsOverview({ status: "PUBLISHED" });
    expect(new Set(onlyPublished.jobs.map((j) => j.id))).toEqual(new Set([published.id, fromB.id]));

    const onlyRecruiterA = await getJobsOverview({ recruiterId: recruiterA.id });
    expect(new Set(onlyRecruiterA.jobs.map((j) => j.id))).toEqual(new Set([draft.id, published.id]));

    const bySearch = await getJobsOverview({ search: "react" });
    expect(bySearch.jobs.map((j) => j.id)).toEqual([published.id]);

    expect(onlyPublished.recruiters.map((r) => r.id)).toEqual(expect.arrayContaining([recruiterA.id, recruiterB.id]));
  });

  it("filtra vagas pelo período de publicação", async () => {
    const recruiter = await createRecruiter();
    const oldJob = await createJob(recruiter.id, { publishedAt: new Date(Date.now() - 60 * DAY), title: "Vaga Antiga" });
    const recentJob = await createJob(recruiter.id, { publishedAt: new Date(Date.now() - 2 * DAY), title: "Vaga Recente" });

    const result = await getJobsOverview({ from: new Date(Date.now() - 5 * DAY) });
    const ids = result.jobs.map((j) => j.id);
    expect(ids).toContain(recentJob.id);
    expect(ids).not.toContain(oldJob.id);
  });

  it("vaga em rascunho não tem dias aberta; sem Proposta Final não tem total de posições", async () => {
    const recruiter = await createRecruiter();
    const draft = await createJob(recruiter.id, { status: "DRAFT" });
    await prisma.processStage.create({ data: { jobId: draft.id, type: "RESUME_ANALYSIS", order: 0, config: {} } });

    const result = await getJobsOverview({});
    const row = result.jobs.find((j) => j.id === draft.id);
    if (!row) throw new Error("vaga não apareceu na visão geral");

    expect(row.daysOpen).toBeNull();
    expect(row.positionsTotal).toBeNull();
    expect(row.bottleneck).toBeNull();
    expect(row.conversionRate).toBeNull();
  });
});
