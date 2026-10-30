// O recrutador monta o e-mail de cada entrevista; ele não trava com a vaga publicada e é o
// que o candidato recebe ao avançar.
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
  return { job, recruiter, interview: job.stages[1]! };
}

beforeEach(() => vi.mocked(sendMail).mockClear());

describe("template do e-mail de entrevista", () => {
  it("pode ser salvo depois de publicar e só vale para etapas de entrevista", async () => {
    const { job, interview } = await createJob("PUBLISHED");
    const view = await setStageEmail(job.id, { stageId: interview.id, emailSubject: "Assunto", emailBody: "Corpo" });
    expect(view.stages[1]).toMatchObject({ emailSubject: "Assunto", emailBody: "Corpo" });

    const cleared = await setStageEmail(job.id, stageEmailSchema.parse({ stageId: interview.id, emailSubject: "", emailBody: "  " }));
    expect(cleared.stages[1]).toMatchObject({ emailSubject: null, emailBody: null });

    await expect(setStageEmail(job.id, { stageId: job.stages[0]!.id, emailBody: "x" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("acompanha a etapa quando o rascunho regrava o pipeline", async () => {
    const { job } = await createJob("DRAFT");
    const view = await setStages(job.id, {
      stages: [{ type: "TECH_INTERVIEW", emailSubject: "Técnica", emailBody: "Olá" }, { type: "RESUME_ANALYSIS", emailBody: "ignorado" }],
    });
    expect(view.stages[0]).toMatchObject({ emailSubject: "Técnica", emailBody: "Olá" });
    expect(view.stages[1]).toMatchObject({ emailSubject: null, emailBody: null });
  });

  it("é o e-mail enviado ao avançar para a entrevista", async () => {
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

    const at = new Date(Date.now() + 86_400_000);
    await recordDecision(applicationId, recruiter.id, "ADVANCE", { scheduledAt: at.toISOString(), url: "https://meet.example.com/abc" });

    await vi.waitFor(() => expect(sendMail).toHaveBeenCalled());
    const mail = vi.mocked(sendMail).mock.calls.at(-1)![0];
    expect(mail.subject).toBe("Entrevista de RH — Vaga Teste");
    expect(mail.text).toContain("Oi Ana Souza, nos vemos em");
    expect(mail.text).toContain(": https://meet.example.com/abc");
  });
});
