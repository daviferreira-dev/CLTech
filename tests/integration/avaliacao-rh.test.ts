// Spec 009: motivo da reprovação com retorno ao candidato, decisão em lote e ficha de
// entrevista padronizada. Mailer simulado: nada sai de verdade.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { applyToJob } from "@/server/applications/apply";
import { recordDecision } from "@/server/applications/decision";
import { recordBulkDecision } from "@/server/applications/bulk-decision";
import { listInterviewEvaluations, upsertInterviewEvaluation } from "@/server/applications/interview-evaluation";
import { getApplicationDetail } from "@/server/applications/detail";
import { closeJob } from "@/server/jobs/builder";
import { encrypt } from "@/server/crypto";
import { sendMail } from "@/server/email/mailer";
import { BULK_DECISION_MAX, bulkDecisionSchema, recordDecisionSchema } from "@/lib/validation/applications";

vi.mock("@/server/email/mailer", () => ({ sendMail: vi.fn(async () => {}) }));

type StageType = "RESUME_ANALYSIS" | "HR_INTERVIEW" | "TECH_INTERVIEW" | "FINAL_OFFER";

async function createRecruiter(name = "Recrutador") {
  return prisma.user.create({
    data: { name, email: `rec-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
}

async function createJob(recruiterId: string, stages: StageType[]) {
  return prisma.job.create({
    data: {
      title: "Vaga Teste",
      description: "Descrição",
      company: "3aq",
      location: "Remoto",
      workMode: "REMOTE",
      seniority: "JUNIOR",
      technologies: ["React"],
      minimumRequirements: "React",
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: recruiterId,
      stages: { create: stages.map((type, order) => ({ type, order, config: {} })) },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

async function apply(jobId: string, name = "Ana Souza") {
  const user = await registerCandidate({ name, email: `c-${Date.now()}-${Math.random()}@example.com`, password: "senhaSegura123" });
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
  await prisma.resume.create({
    data: {
      candidateId: candidate.id,
      storageKey: `resumes/${candidate.id}/cv.pdf`,
      originalFilename: "cv.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      isCurrent: true,
      extractedText: encrypt("React"),
      parseStatus: "PARSED",
    },
  });
  const { applicationId } = await applyToJob(user.id, jobId);
  return { applicationId, email: user.email };
}

/** Último e-mail enviado para `to` (o envio é fire-and-forget: espera chegar). */
async function lastMailTo(to: string) {
  await vi.waitFor(() => expect(vi.mocked(sendMail).mock.calls.some(([m]) => m.to === to && /Atualiza/.test(m.subject))).toBe(true));
  return vi.mocked(sendMail).mock.calls.filter(([m]) => m.to === to).at(-1)![0];
}

beforeEach(() => vi.mocked(sendMail).mockClear());

describe("motivo da reprovação", () => {
  it("a rota exige motivo ao reprovar e no lote", () => {
    expect(recordDecisionSchema.safeParse({ decision: "REJECT" }).success).toBe(false);
    expect(recordDecisionSchema.safeParse({ decision: "REJECT", rejection: { reason: "JOB_CLOSED" } }).success).toBe(false);
    expect(recordDecisionSchema.safeParse({ decision: "REJECT", rejection: { reason: "TECHNICAL_SKILLS" } }).success).toBe(true);
    expect(recordDecisionSchema.safeParse({ decision: "ADVANCE" }).success).toBe(true);
    expect(BULK_DECISION_MAX).toBe(20);
    const ids = Array.from({ length: BULK_DECISION_MAX + 1 }, () => crypto.randomUUID());
    expect(bulkDecisionSchema.safeParse({ applicationIds: ids, decision: "REJECT", rejection: { reason: "OTHER" } }).success).toBe(false);
    expect(bulkDecisionSchema.safeParse({ applicationIds: ids.slice(0, BULK_DECISION_MAX), decision: "REJECT", rejection: { reason: "OTHER" } }).success).toBe(true);
  });

  it("grava motivo e retorno cifrado; o retorno vai no e-mail padrão num bloco próprio", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    const { applicationId, email } = await apply(job.id);

    await recordDecision(applicationId, recruiter.id, "REJECT", undefined, {
      reason: "TECHNICAL_SKILLS",
      feedback: "Recomendamos aprofundar testes automatizados.",
    });

    const row = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(row.rejectionReason).toBe("TECHNICAL_SKILLS");
    expect(row.rejectionFeedback).not.toContain("testes automatizados"); // cifrado em repouso

    const detail = await getApplicationDetail(applicationId);
    expect(detail.rejection).toMatchObject({ reason: "TECHNICAL_SKILLS", feedback: "Recomendamos aprofundar testes automatizados." });

    const mail = await lastMailTo(email);
    expect(mail.text).toContain("Retorno do recrutador:\nRecomendamos aprofundar testes automatizados.");
    // A categoria é interna: o modelo padrão não a usa.
    expect(mail.text).not.toContain("Conhecimentos técnicos abaixo");
  });

  it("modelo com {{motivo}} e {{retorno}} preenche as variáveis sem repetir o bloco", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    await prisma.job.update({
      where: { id: job.id },
      data: { rejectedEmailMode: "CUSTOM", rejectedEmailSubject: "Atualização — {{vaga}}", rejectedEmailBody: "Motivo: {{motivo}}. {{retorno}}" },
    });
    const { applicationId, email } = await apply(job.id);

    await recordDecision(applicationId, recruiter.id, "REJECT", undefined, { reason: "CODE_TEST_SCORE", feedback: "Revise recursão." });

    const mail = await lastMailTo(email);
    expect(mail.text).toContain("Motivo: Resultado do teste de código. Revise recursão.");
    expect(mail.text).not.toContain("Retorno do recrutador");
  });

  it("encerrar a vaga grava JOB_CLOSED; preencher as vagas grava POSITION_FILLED", async () => {
    const recruiter = await createRecruiter();
    const closing = await createJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    const a = await apply(closing.id);
    await closeJob(closing.id, recruiter.id);
    expect((await prisma.application.findUniqueOrThrow({ where: { id: a.applicationId } })).rejectionReason).toBe("JOB_CLOSED");

    const filling = await createJob(recruiter.id, ["FINAL_OFFER"]);
    const winner = await apply(filling.id, "Vencedora");
    const other = await apply(filling.id, "Outra");
    await recordDecision(winner.applicationId, recruiter.id, "ADVANCE");
    const loser = await prisma.application.findUniqueOrThrow({ where: { id: other.applicationId } });
    expect(loser).toMatchObject({ status: "REJECTED", rejectionReason: "POSITION_FILLED" });
  });
});

describe("decisão em lote", () => {
  it("reprova os em andamento, ignora os já finalizados e manda um e-mail por candidato", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    const apps = [await apply(job.id, "Um"), await apply(job.id, "Dois"), await apply(job.id, "Três")];
    const already = await apply(job.id, "Quatro");
    await recordDecision(already.applicationId, recruiter.id, "REJECT", undefined, { reason: "OTHER" });
    await lastMailTo(already.email); // o envio é assíncrono: espera antes de zerar a contagem
    vi.mocked(sendMail).mockClear();

    const result = await recordBulkDecision(job.id, recruiter.id, [...apps.map((a) => a.applicationId), already.applicationId], "REJECT", {
      reason: "REQUIREMENTS_NOT_MET",
    });

    expect(result.done).toHaveLength(3);
    expect(result.skipped.map((s) => s.name)).toEqual(["Quatro"]);
    expect(result.failed).toHaveLength(0);
    const rows = await prisma.application.findMany({ where: { id: { in: apps.map((a) => a.applicationId) } } });
    expect(rows.every((r) => r.status === "REJECTED" && r.rejectionReason === "REQUIREMENTS_NOT_MET")).toBe(true);
    await vi.waitFor(() => expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(3));
  });

  it("recusa avançar em lote quando a próxima etapa é entrevista", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, ["RESUME_ANALYSIS", "HR_INTERVIEW"]);
    const { applicationId } = await apply(job.id);
    await expect(recordBulkDecision(job.id, recruiter.id, [applicationId], "ADVANCE")).rejects.toMatchObject({ status: 400 });
    expect((await prisma.application.findUniqueOrThrow({ where: { id: applicationId } })).currentStageId).toBe(job.stages[0]!.id);
  });

  it("candidatura de outra vaga entra como falha, sem mexer nela", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    const otherJob = await createJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    const foreign = await apply(otherJob.id);
    const result = await recordBulkDecision(job.id, recruiter.id, [foreign.applicationId], "REJECT", { reason: "OTHER" });
    expect(result.failed).toHaveLength(1);
    expect((await prisma.application.findUniqueOrThrow({ where: { id: foreign.applicationId } })).status).toBe("IN_PROGRESS");
  });
});

describe("ficha de entrevista", () => {
  async function inInterview() {
    const recruiter = await createRecruiter("Rita");
    const second = await createRecruiter("Paulo");
    const job = await createJob(recruiter.id, ["RESUME_ANALYSIS", "TECH_INTERVIEW", "FINAL_OFFER"]);
    const { applicationId } = await apply(job.id);
    await recordDecision(applicationId, recruiter.id, "ADVANCE", { scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), url: "https://meet.example.com/x" });
    return { recruiter, second, job, applicationId };
  }
  const full = { logica: 4, conhecimento: 5, qualidade: 3, comunicacao_tecnica: 4 };

  it("uma ficha por avaliador na etapa, com médias por critério e comentário cifrado", async () => {
    const { recruiter, second, applicationId } = await inInterview();
    await upsertInterviewEvaluation(applicationId, recruiter.id, { scores: full, recommendation: "ADVANCE", comment: "Boa base de testes." });
    await upsertInterviewEvaluation(applicationId, second.id, { scores: { ...full, logica: 2 }, recommendation: "UNSURE" });
    // Mesmo avaliador de novo: atualiza, não duplica.
    await upsertInterviewEvaluation(applicationId, recruiter.id, { scores: { ...full, qualidade: 5 }, recommendation: "ADVANCE", comment: "Boa base de testes." });

    expect(await prisma.interviewEvaluation.count({ where: { applicationId } })).toBe(2);
    const raw = await prisma.interviewEvaluation.findFirstOrThrow({ where: { evaluatorUserId: recruiter.id } });
    expect(raw.comment).not.toContain("Boa base");

    const [stage] = await listInterviewEvaluations(applicationId, recruiter.id);
    expect(stage).toMatchObject({ stageType: "TECH_INTERVIEW", current: true });
    expect(stage!.averages).toEqual({ logica: 3, conhecimento: 5, qualidade: 4, comunicacao_tecnica: 4 });
    expect(stage!.evaluations.find((e) => e.mine)).toMatchObject({ evaluatorName: "Rita", comment: "Boa base de testes.", average: 4.5 });
  });

  it("recusa critério faltando, a mais ou fora de 1 a 5", async () => {
    const { recruiter, applicationId } = await inInterview();
    const bad = [{ logica: 4 }, { ...full, extra: 3 }, { ...full, logica: 6 }, { ...full, logica: 0 }];
    for (const scores of bad) {
      await expect(upsertInterviewEvaluation(applicationId, recruiter.id, { scores, recommendation: "ADVANCE" })).rejects.toMatchObject({ status: 400 });
    }
  });

  it("fora de entrevista ou depois de decidida, a ficha não muda", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    const { applicationId } = await apply(job.id);
    await expect(upsertInterviewEvaluation(applicationId, recruiter.id, { scores: full, recommendation: "ADVANCE" })).rejects.toMatchObject({
      code: "NOT_INTERVIEW_STAGE",
    });

    const interview = await inInterview();
    await recordDecision(interview.applicationId, interview.recruiter.id, "REJECT", undefined, { reason: "INTERVIEW_PERFORMANCE" });
    await expect(
      upsertInterviewEvaluation(interview.applicationId, interview.recruiter.id, { scores: full, recommendation: "REJECT" }),
    ).rejects.toMatchObject({ code: "STAGE_CLOSED" });
  });
});
