// Spec 008: o RH monta o e-mail de cada etapa — padrão, modelo da biblioteca ou texto
// próprio, ou desliga o envio. Não trava com a vaga publicada e é o que o candidato recebe
// ao avançar.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { applyToJob } from "@/server/applications/apply";
import { recordDecision } from "@/server/applications/decision";
import { setStageEmail, setStages } from "@/server/jobs/builder";
import { encrypt } from "@/server/crypto";
import { stageEmailSchema } from "@/lib/validation/jobs";
import { sendMail } from "@/server/email/mailer";

vi.mock("@/server/email/mailer", () => ({ sendMail: vi.fn(async () => {}) }));

async function createJob(status: "DRAFT" | "PUBLISHED") {
  const recruiter = await prisma.user.create({
    data: { name: "Recrutador", email: `rec-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
  const job = await prisma.job.create({
    data: {
      title: "Vaga Teste",
      description: "Descrição",
      company: "3aq",
      location: "Remoto",
      workMode: "REMOTE",
      seniority: "JUNIOR",
      technologies: ["React"],
      minimumRequirements: "React",
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      createdById: recruiter.id,
      stages: { create: [{ type: "RESUME_ANALYSIS", order: 0, config: {} }, { type: "HR_INTERVIEW", order: 1, config: {} }] },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  return { job, recruiter, resumeStage: job.stages[0]!, interview: job.stages[1]! };
}

beforeEach(() => vi.mocked(sendMail).mockClear());

describe("e-mail de etapa (qualquer tipo, não só entrevista)", () => {
  it("texto próprio: salva, infere CUSTOM sem emailMode explícito, e limpa com campos vazios", async () => {
    const { job, resumeStage } = await createJob("PUBLISHED");
    const view = await setStageEmail(job.id, { stageId: resumeStage.id, emailSubject: "Assunto", emailBody: "Corpo" });
    expect(view.stages[0]).toMatchObject({ emailMode: "CUSTOM", emailSubject: "Assunto", emailBody: "Corpo" });

    const cleared = await setStageEmail(job.id, stageEmailSchema.parse({ stageId: resumeStage.id, emailSubject: "", emailBody: "  " }));
    expect(cleared.stages[0]).toMatchObject({ emailMode: "DEFAULT", emailTemplateId: null, emailSubject: null, emailBody: null });
  });

  it("modo TEMPLATE exige um modelo que exista na biblioteca", async () => {
    const { job, resumeStage } = await createJob("PUBLISHED");
    await expect(setStageEmail(job.id, { stageId: resumeStage.id, emailMode: "TEMPLATE" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      setStageEmail(job.id, { stageId: resumeStage.id, emailMode: "TEMPLATE", emailTemplateId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const template = await prisma.emailTemplate.create({ data: { name: "Modelo X", subject: "Assunto X", body: "Corpo X" } });
    const view = await setStageEmail(job.id, { stageId: resumeStage.id, emailMode: "TEMPLATE", emailTemplateId: template.id });
    expect(view.stages[0]).toMatchObject({ emailMode: "TEMPLATE", emailTemplateId: template.id, emailSubject: null, emailBody: null });
  });

  it("modo CUSTOM exige assunto e corpo preenchidos", async () => {
    const { job, resumeStage } = await createJob("PUBLISHED");
    await expect(setStageEmail(job.id, { stageId: resumeStage.id, emailMode: "CUSTOM", emailBody: "só corpo" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("modo OFF desliga, sem exigir mais nada", async () => {
    const { job, resumeStage } = await createJob("PUBLISHED");
    const view = await setStageEmail(job.id, { stageId: resumeStage.id, emailMode: "OFF" });
    expect(view.stages[0]).toMatchObject({ emailMode: "OFF" });
  });

  it("acompanha a etapa quando o rascunho regrava o pipeline", async () => {
    const { job } = await createJob("DRAFT");
    const view = await setStages(job.id, {
      stages: [{ type: "TECH_INTERVIEW", emailSubject: "Técnica", emailBody: "Olá" }, { type: "RESUME_ANALYSIS" }],
    });
    expect(view.stages[0]).toMatchObject({ emailMode: "CUSTOM", emailSubject: "Técnica", emailBody: "Olá" });
    // Sem nenhum campo de e-mail: fica DEFAULT.
    expect(view.stages[1]).toMatchObject({ emailMode: "DEFAULT", emailSubject: null, emailBody: null });
  });

  it("é o e-mail enviado ao avançar para a etapa, com as variáveis do RH", async () => {
    const { job, recruiter, interview } = await createJob("PUBLISHED");
    await setStageEmail(job.id, {
      stageId: interview.id,
      emailSubject: "{{etapa}} — {{vaga}}",
      emailBody: "Oi {{candidato}}, nos vemos em {{data}} às {{horario}}: {{link}}",
    });
    const user = await registerCandidate({ name: "Ana Souza", email: `ana-${Date.now()}@example.com`, password: "senhaSegura123" });
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
    const { applicationId } = await applyToJob(user.id, job.id);
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalled()); // espera "candidatura recebida"
    vi.mocked(sendMail).mockClear();

    const at = new Date(Date.now() + 86_400_000);
    await recordDecision(applicationId, recruiter.id, "ADVANCE", { scheduledAt: at.toISOString(), url: "https://meet.example.com/abc" });

    await vi.waitFor(() => expect(sendMail).toHaveBeenCalled());
    const mail = vi.mocked(sendMail).mock.calls.at(-1)![0];
    expect(mail.subject).toBe("Entrevista de RH — Vaga Teste");
    expect(mail.text).toContain("Oi Ana Souza, nos vemos em");
    expect(mail.text).toContain(": https://meet.example.com/abc");
  });

  it("modo OFF não envia nada ao avançar para a etapa", async () => {
    const { job, recruiter, interview } = await createJob("PUBLISHED");
    await setStageEmail(job.id, { stageId: interview.id, emailMode: "OFF" });
    const user = await registerCandidate({ name: "Bia Lima", email: `bia-${Date.now()}@example.com`, password: "senhaSegura123" });
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
    const { applicationId } = await applyToJob(user.id, job.id);
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalled()); // espera "candidatura recebida"
    vi.mocked(sendMail).mockClear();

    const at = new Date(Date.now() + 86_400_000);
    await recordDecision(applicationId, recruiter.id, "ADVANCE", { scheduledAt: at.toISOString(), url: "https://meet.example.com/abc" });

    await new Promise((r) => setTimeout(r, 50));
    expect(sendMail).not.toHaveBeenCalled();
  });
});
