// Spec 008: envio automático em cada transição — candidatura recebida, reprovado/aprovado
// com o e-mail da vaga, vaga encerrada em lote, e falha de envio nunca quebra a decisão.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { applyToJob } from "@/server/applications/apply";
import { recordDecision } from "@/server/applications/decision";
import { closeJob, updateDraftJob } from "@/server/jobs/builder";
import { encrypt } from "@/server/crypto";
import { sendMail } from "@/server/email/mailer";

vi.mock("@/server/email/mailer", () => ({ sendMail: vi.fn(async () => {}) }));

async function createRecruiter() {
  return prisma.user.create({
    data: { name: "Recrutador", email: `rec-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
}

async function createPublishedJob(recruiterId: string, stages: Array<"RESUME_ANALYSIS" | "FINAL_OFFER">) {
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
      extractedText: encrypt("React"),
      parseStatus: "PARSED",
    },
  });
  return user;
}

beforeEach(() => vi.mocked(sendMail).mockClear());

describe("candidatura recebida", () => {
  it("applyToJob avisa o candidato por e-mail", async () => {
    const recruiter = await createRecruiter();
    const job = await createPublishedJob(recruiter.id, ["RESUME_ANALYSIS"]);
    const user = await createCandidateWithResume(`recebida-${Date.now()}@example.com`);

    await applyToJob(user.id, job.id);

    await vi.waitFor(() => expect(sendMail).toHaveBeenCalled());
    const mail = vi.mocked(sendMail).mock.calls.at(-1)![0];
    expect(mail.subject).toContain("Recebemos sua candidatura");
    expect(mail.text).toContain("Vaga Teste");
  });
});

describe("reprovado/aprovado usam o e-mail configurado na vaga", () => {
  it("REJECT usa o texto próprio configurado em rejectedEmail*", async () => {
    const recruiter = await createRecruiter();
    const job = await createPublishedJob(recruiter.id, ["RESUME_ANALYSIS"]);
    await updateDraftJob(job.id, { rejectedEmailMode: "CUSTOM", rejectedEmailSubject: "Não seguiu — {{vaga}}", rejectedEmailBody: "Sentimos muito, {{candidato}}." });
    const user = await createCandidateWithResume(`reprovado-${Date.now()}@example.com`);
    const { applicationId } = await applyToJob(user.id, job.id);
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalled()); // "candidatura recebida"
    vi.mocked(sendMail).mockClear();

    await recordDecision(applicationId, recruiter.id, "REJECT");

    await vi.waitFor(() => expect(sendMail).toHaveBeenCalled());
    const mail = vi.mocked(sendMail).mock.calls.at(-1)![0];
    expect(mail.subject).toBe("Não seguiu — Vaga Teste");
    expect(mail.text).toContain("Sentimos muito, Candidato Teste.");
  });

  it("aprovar a última etapa usa o modelo da biblioteca configurado em approvedEmail*", async () => {
    const recruiter = await createRecruiter();
    const job = await createPublishedJob(recruiter.id, ["RESUME_ANALYSIS", "FINAL_OFFER"]);
    const template = await prisma.emailTemplate.create({ data: { name: "Boas-vindas", subject: "Parabéns — {{vaga}}", body: "Bem-vindo(a), {{candidato}}!" } });
    await updateDraftJob(job.id, { approvedEmailMode: "TEMPLATE", approvedEmailTemplateId: template.id });
    const user = await createCandidateWithResume(`aprovado-${Date.now()}@example.com`);
    const { applicationId } = await applyToJob(user.id, job.id);
    await recordDecision(applicationId, recruiter.id, "ADVANCE");
    // Espera o e-mail de "candidatura recebida" e o de avanço para Proposta Final — ambos
    // disparados em segundo plano (keepAlive) — antes de limpar o mock para a aprovação.
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(2));
    vi.mocked(sendMail).mockClear();

    const result = await recordDecision(applicationId, recruiter.id, "ADVANCE");
    expect(result.status).toBe("APPROVED");

    await vi.waitFor(() => expect(sendMail).toHaveBeenCalled());
    const mail = vi.mocked(sendMail).mock.calls.at(-1)![0];
    expect(mail.subject).toBe("Parabéns — Vaga Teste");
    expect(mail.text).toContain("Bem-vindo(a), Candidato Teste!");
  });
});

describe("encerrar vaga avisa em lote quem ainda estava em andamento", () => {
  it("closeJob reprova e envia um e-mail de vaga encerrada por candidato", async () => {
    const recruiter = await createRecruiter();
    const job = await createPublishedJob(recruiter.id, ["RESUME_ANALYSIS"]);
    const suffix = `${Date.now()}-${Math.random()}`;
    const a = await createCandidateWithResume(`a-${suffix}@example.com`);
    const b = await createCandidateWithResume(`b-${suffix}@example.com`);
    const appA = await applyToJob(a.id, job.id);
    const appB = await applyToJob(b.id, job.id);
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(2)); // "candidatura recebida" de A e B
    vi.mocked(sendMail).mockClear();

    await closeJob(job.id, recruiter.id);

    expect((await prisma.application.findUniqueOrThrow({ where: { id: appA.applicationId } })).status).toBe("REJECTED");
    expect((await prisma.application.findUniqueOrThrow({ where: { id: appB.applicationId } })).status).toBe("REJECTED");
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(2));
    const subjects = vi.mocked(sendMail).mock.calls.map((c) => c[0].subject);
    expect(subjects.every((s) => s.includes("Atualização sobre sua candidatura"))).toBe(true);
  });
});

describe("falha de envio não quebra a decisão", () => {
  it("recordDecision continua mesmo com o mailer rejeitando", async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new Error("SMTP indisponível"));
    const recruiter = await createRecruiter();
    const job = await createPublishedJob(recruiter.id, ["RESUME_ANALYSIS"]);
    const user = await createCandidateWithResume(`falha-${Date.now()}@example.com`);
    const { applicationId } = await applyToJob(user.id, job.id);

    const result = await recordDecision(applicationId, recruiter.id, "REJECT");
    expect(result.status).toBe("REJECTED");

    // O envio foi mesmo tentado (e falhou) — notify.ts engoliu o erro, não escondeu o envio.
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalled());
  });
});
