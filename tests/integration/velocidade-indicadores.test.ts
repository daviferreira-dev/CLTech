// Spec 010 (FR-1001, FR-1002, FR-1004): tempo do anúncio à proposta e candidatos parados, lidos
// do histórico de etapas, e o painel do recrutador devolvendo os dois (com recorte por vaga).
import { afterEach, describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getTimeToOffer } from "@/server/jobs/metrics";
import { listStalledCandidates } from "@/server/jobs/stalled";
import { getDashboard } from "@/server/jobs/dashboard";
import type { JobStatus, ProcessStageType } from "@prisma/client";

const DAY = 86_400_000;
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);

async function createRecruiter() {
  return prisma.user.create({ data: { name: "Recrutador", email: `rec-${Math.random()}@example.com`, role: "RECRUITER" } });
}

async function createJob(
  createdById: string,
  stageTypes: ProcessStageType[],
  opts: { status?: JobStatus; publishedAt?: Date | null; title?: string } = {},
) {
  const job = await prisma.job.create({
    data: {
      title: opts.title ?? "Vaga",
      description: "Descrição",
      company: "3aq",
      location: "Remoto",
      workMode: "REMOTE",
      seniority: "JUNIOR",
      technologies: ["TypeScript"],
      minimumRequirements: "TypeScript",
      status: opts.status ?? "PUBLISHED",
      publishedAt: opts.publishedAt === undefined ? daysAgo(30) : opts.publishedAt,
      createdById,
    },
  });
  const stages = [];
  for (const [order, type] of stageTypes.entries()) {
    const config = type === "CODE_TEST" ? { timeLimitMinutes: 60 } : {};
    stages.push(await prisma.processStage.create({ data: { jobId: job.id, type, order, config } }));
  }
  return { job, stages };
}

/** Candidatura com o histórico dado: cada etapa com entrada e (opcional) saída. */
async function createApplication(
  jobId: string,
  name: string,
  history: Array<{ stageId: string; enteredAt: Date; exitedAt?: Date }>,
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" = "IN_PROGRESS",
) {
  const user = await prisma.user.create({ data: { name, email: `c-${Math.random()}@example.com`, role: "CANDIDATE" } });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  const resume = await prisma.resume.create({
    data: { candidateId: candidate.id, storageKey: `r/${candidate.id}`, originalFilename: "cv.pdf", mimeType: "application/pdf", sizeBytes: 1 },
  });
  const application = await prisma.application.create({
    data: { candidateId: candidate.id, jobId, resumeId: resume.id, currentStageId: history.at(-1)!.stageId, status },
  });
  for (const row of history) {
    await prisma.applicationStageHistory.create({
      data: { applicationId: application.id, stageId: row.stageId, enteredAt: row.enteredAt, exitedAt: row.exitedAt ?? null },
    });
  }
  return application;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getTimeToOffer (FR-1001)", () => {
  it("média por vaga: primeira entrada na Proposta Final, ou aprovação sem essa etapa", async () => {
    vi.stubEnv("HIRING_BASELINE_DAYS", "45");
    const recruiter = await createRecruiter();

    // Vaga A: publicada há 30 dias; o primeiro chega à proposta 10 dias depois, o segundo 15.
    const a = await createJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    await createApplication(a.job.id, "A1", [
      { stageId: a.stages[0]!.id, enteredAt: daysAgo(29), exitedAt: daysAgo(20) },
      { stageId: a.stages[1]!.id, enteredAt: daysAgo(20) },
    ]);
    await createApplication(a.job.id, "A2", [
      { stageId: a.stages[0]!.id, enteredAt: daysAgo(28), exitedAt: daysAgo(15) },
      { stageId: a.stages[1]!.id, enteredAt: daysAgo(15) },
    ]);

    // Vaga B: sem Proposta Final; aprovado 20 dias depois da publicação (30 → 10 dias atrás).
    const b = await createJob(recruiter.id, ["RESUME_ANALYSIS", "HR_INTERVIEW"]);
    await createApplication(
      b.job.id,
      "B1",
      [
        { stageId: b.stages[0]!.id, enteredAt: daysAgo(29), exitedAt: daysAgo(18) },
        { stageId: b.stages[1]!.id, enteredAt: daysAgo(18), exitedAt: daysAgo(10) },
      ],
      "APPROVED",
    );

    // Fora da conta: ninguém chegou à proposta; e um rascunho nunca publicado.
    const c = await createJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    await createApplication(c.job.id, "C1", [{ stageId: c.stages[0]!.id, enteredAt: daysAgo(29) }]);
    await createJob(recruiter.id, ["FINAL_OFFER"], { status: "DRAFT", publishedAt: null });

    const all = await getTimeToOffer();
    expect(all).toEqual({ avgDays: 15, jobsCounted: 2, baselineDays: 45, baselineLabel: "Referência de mercado", reductionPct: 67 });

    // Recorte por vaga.
    const onlyA = await getTimeToOffer({ jobId: a.job.id });
    expect(onlyA.avgDays).toBe(10);
    expect(onlyA.jobsCounted).toBe(1);

    const onlyC = await getTimeToOffer({ jobId: c.job.id });
    expect(onlyC).toMatchObject({ avgDays: null, jobsCounted: 0, reductionPct: null });
  });

  it("vaga encerrada continua na conta", async () => {
    const recruiter = await createRecruiter();
    const { job, stages } = await createJob(recruiter.id, ["FINAL_OFFER"], { status: "CLOSED", publishedAt: daysAgo(10) });
    await createApplication(job.id, "X", [{ stageId: stages[0]!.id, enteredAt: daysAgo(4), exitedAt: daysAgo(3) }], "APPROVED");

    const result = await getTimeToOffer();
    expect(result.avgDays).toBe(6);
    expect(result.baselineDays).toBeNull();
  });
});

describe("listStalledCandidates (FR-1002)", () => {
  it("só em andamento, em vaga publicada, há mais de N dias na etapa; mais antigo primeiro", async () => {
    const recruiter = await createRecruiter();
    const { job, stages } = await createJob(recruiter.id, ["RESUME_ANALYSIS", "HR_INTERVIEW"], { title: "Backend" });

    const old = await createApplication(job.id, "Parada Antiga", [
      { stageId: stages[0]!.id, enteredAt: daysAgo(20), exitedAt: daysAgo(12) },
      { stageId: stages[1]!.id, enteredAt: daysAgo(12) },
    ]);
    const recent = await createApplication(job.id, "Parada Recente", [{ stageId: stages[0]!.id, enteredAt: daysAgo(9) }]);
    await createApplication(job.id, "Em dia", [{ stageId: stages[0]!.id, enteredAt: daysAgo(3) }]);
    await createApplication(job.id, "Reprovada", [{ stageId: stages[0]!.id, enteredAt: daysAgo(30), exitedAt: daysAgo(29) }], "REJECTED");

    // Vaga encerrada e rascunho não entram.
    const closed = await createJob(recruiter.id, ["RESUME_ANALYSIS"], { status: "CLOSED" });
    await createApplication(closed.job.id, "De vaga encerrada", [{ stageId: closed.stages[0]!.id, enteredAt: daysAgo(30) }]);
    const draft = await createJob(recruiter.id, ["RESUME_ANALYSIS"], { status: "DRAFT", publishedAt: null });
    await createApplication(draft.job.id, "De rascunho", [{ stageId: draft.stages[0]!.id, enteredAt: daysAgo(30) }]);

    const result = await listStalledCandidates({ now });
    expect(result.map((r) => r.candidateName)).toEqual(["Parada Antiga", "Parada Recente"]);
    expect(result[0]).toEqual({
      applicationId: old.id,
      candidateName: "Parada Antiga",
      jobId: job.id,
      jobTitle: "Backend",
      stageType: "HR_INTERVIEW",
      days: 12,
      waitingOn: "RECRUITER",
    });
    expect(result[1]).toMatchObject({ applicationId: recent.id, stageType: "RESUME_ANALYSIS", days: 9 });
  });

  it("STALLED_CANDIDATE_DAYS muda o limite", async () => {
    vi.stubEnv("STALLED_CANDIDATE_DAYS", "10");
    const recruiter = await createRecruiter();
    const { job, stages } = await createJob(recruiter.id, ["RESUME_ANALYSIS"]);
    await createApplication(job.id, "Nove dias", [{ stageId: stages[0]!.id, enteredAt: daysAgo(9) }]);
    await createApplication(job.id, "Onze dias", [{ stageId: stages[0]!.id, enteredAt: daysAgo(11) }]);

    const result = await listStalledCandidates({ now });
    expect(result.map((r) => r.candidateName)).toEqual(["Onze dias"]);
  });

  it("teste de código: espera do candidato dentro do prazo, do RH depois do envio ou do prazo (D4)", async () => {
    const recruiter = await createRecruiter();
    const { job, stages } = await createJob(recruiter.id, ["CODE_TEST"]);
    const codeStage = stages[0]!;
    const challenge = await prisma.challenge.create({
      data: { title: "Soma", statement: "Some", languages: ["python"], difficulty: "EASY", testCases: [] },
    });

    const notOpened = await createApplication(job.id, "Nem abriu", [{ stageId: codeStage.id, enteredAt: daysAgo(10) }]);

    const overdue = await createApplication(job.id, "Prazo vencido", [{ stageId: codeStage.id, enteredAt: daysAgo(9) }]);
    await prisma.codeDraft.create({
      data: { applicationId: overdue.id, challengeId: challenge.id, stageId: codeStage.id, language: "python", sourceCode: "x", startedAt: daysAgo(8) },
    });

    const submitted = await createApplication(job.id, "Enviou", [{ stageId: codeStage.id, enteredAt: daysAgo(8) }]);
    await prisma.codeSubmission.create({
      data: { applicationId: submitted.id, challengeId: challenge.id, language: "python", sourceCode: "x", executionStatus: "COMPLETED" },
    });

    const result = await listStalledCandidates({ now });
    const byName = Object.fromEntries(result.map((r) => [r.candidateName, r.waitingOn]));
    expect(byName).toEqual({ "Nem abriu": "CANDIDATE", "Prazo vencido": "RECRUITER", Enviou: "RECRUITER" });
    expect(result[0]!.applicationId).toBe(notOpened.id);
  });

  it("recorta por vaga", async () => {
    const recruiter = await createRecruiter();
    const a = await createJob(recruiter.id, ["RESUME_ANALYSIS"]);
    const b = await createJob(recruiter.id, ["RESUME_ANALYSIS"]);
    await createApplication(a.job.id, "Da A", [{ stageId: a.stages[0]!.id, enteredAt: daysAgo(8) }]);
    await createApplication(b.job.id, "Da B", [{ stageId: b.stages[0]!.id, enteredAt: daysAgo(8) }]);

    const result = await listStalledCandidates({ jobId: b.job.id, now });
    expect(result.map((r) => r.candidateName)).toEqual(["Da B"]);
  });
});

describe("getDashboard (FR-1004)", () => {
  it("devolve o tempo até a proposta e os parados, respeitando o recorte por vaga", async () => {
    const recruiter = await createRecruiter();
    const a = await createJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    await createApplication(a.job.id, "Na proposta", [
      { stageId: a.stages[0]!.id, enteredAt: daysAgo(29), exitedAt: daysAgo(22) },
      { stageId: a.stages[1]!.id, enteredAt: daysAgo(22) },
    ]);
    const b = await createJob(recruiter.id, ["RESUME_ANALYSIS"]);
    await createApplication(b.job.id, "Parado na B", [{ stageId: b.stages[0]!.id, enteredAt: daysAgo(8) }]);

    const all = await getDashboard();
    expect(all.timeToOffer).toMatchObject({ avgDays: 8, jobsCounted: 1 });
    expect(all.stalledDays).toBe(7);
    expect(all.stalledCandidates.map((s) => s.candidateName)).toEqual(["Na proposta", "Parado na B"]);

    const onlyB = await getDashboard(b.job.id);
    expect(onlyB.timeToOffer).toMatchObject({ avgDays: null, jobsCounted: 0 });
    expect(onlyB.stalledCandidates.map((s) => s.candidateName)).toEqual(["Parado na B"]);
  });
});
