// Spec 006, US4 e US5 — exportação e exclusão de conta pelo titular (LGPD art. 18, II e VI).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { encrypt } from "@/server/crypto";
import { registerCandidate } from "@/server/auth/register";
import { updateProfile } from "@/server/candidates/profile";
import { createJob, publishJob, setStages } from "@/server/jobs/builder";
import { createChallenge } from "@/server/code-test/challenges";
import { deleteMyAccount, exportMyData } from "@/server/candidates/privacy";

const deletePrivateObjects = vi.fn(async (_keys: string[]) => {});
vi.mock("@/server/storage", () => ({ deletePrivateObjects: (keys: string[]) => deletePrivateObjects(keys) }));

beforeEach(() => deletePrivateObjects.mockReset());

const HIDDEN_MARKER = "CASO_OCULTO_9d1e";

/** Candidata com telefone, currículo, candidatura com histórico, avaliação, rascunho e submissão. */
async function fullCandidate() {
  const recruiter = await prisma.user.create({
    data: { name: "R", email: `rec-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
  const challenge = await createChallenge({
    title: "Eco",
    statement: "Devolva a entrada.",
    languages: ["python"],
    difficulty: "EASY",
    timeLimitSeconds: 5,
    testCases: [
      { input: "a", expectedOutput: "a", hidden: false },
      { input: HIDDEN_MARKER, expectedOutput: HIDDEN_MARKER, hidden: true },
    ],
  });
  const job = await createJob(recruiter.id, {
    title: "Vaga LGPD",
    description: "Descrição",
    company: "3aq",
    location: "Remoto",
    workMode: "REMOTE",
    seniority: "JUNIOR",
    technologies: ["Python"],
    minimumRequirements: "Python",
  });
  await setStages(job.id, {
    stages: [{ type: "CODE_TEST", config: { challengeId: challenge.id, languages: ["python"], timeLimitMinutes: 60 } }],
  });
  const published = await publishJob(job.id);

  const user = await registerCandidate({ name: "Maria Souza", email: `maria-${Date.now()}@example.com`, password: "senhaSegura123" });
  await updateProfile(user.id, { phone: "11987654321", city: "Campinas" });
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
  const resume = await prisma.resume.create({
    data: { candidateId: candidate.id, storageKey: "resumes/x/obj-1", originalFilename: "cv.pdf", mimeType: "application/pdf", sizeBytes: 10 },
  });
  const stage = published.stages[0]!;
  const application = await prisma.application.create({
    data: {
      candidateId: candidate.id,
      jobId: job.id,
      resumeId: resume.id,
      currentStageId: stage.id,
      stageHistory: { create: { stageId: stage.id } },
    },
  });
  const evaluation = await prisma.evaluation.create({
    data: { applicationId: application.id, type: "CODE_TEST", score: 77, justification: { passed: 1 } },
  });
  await prisma.codeDraft.create({
    data: { applicationId: application.id, challengeId: challenge.id, stageId: stage.id, language: "python", sourceCode: encrypt("print('meu rascunho')") },
  });
  await prisma.codeSubmission.create({
    data: {
      applicationId: application.id,
      challengeId: challenge.id,
      language: "python",
      sourceCode: encrypt("print('minha entrega')"),
      executionStatus: "COMPLETED",
      evaluationId: evaluation.id,
    },
  });
  return { user, candidate, application, job: published };
}

describe("exportação dos dados do titular (US4)", () => {
  it("entrega perfil decifrado, candidaturas e o código escrito", async () => {
    const { user } = await fullCandidate();
    const data = await exportMyData(user.id);

    expect(data.account).toMatchObject({ name: "Maria Souza", email: user.email });
    expect(data.profile).toMatchObject({ phone: "11987654321", city: "Campinas" });
    expect(data.resumes).toHaveLength(1);
    expect(data.applications).toHaveLength(1);
    expect(data.applications[0]!.job.title).toBe("Vaga LGPD");
    expect(data.applications[0]!.stageHistory).toHaveLength(1);
    expect(data.applications[0]!.codeDrafts[0]!.sourceCode).toBe("print('meu rascunho')");
    expect(data.applications[0]!.codeSubmissions[0]!.sourceCode).toBe("print('minha entrega')");
  });

  it("não leva hash de senha, casos ocultos, notas nem texto cifrado", async () => {
    const { user } = await fullCandidate();
    const json = JSON.stringify(await exportMyData(user.id));

    expect(json).not.toMatch(/passwordHash|\$argon2/);
    expect(json).not.toContain(HIDDEN_MARKER);
    expect(json).not.toContain("\"score\"");
    expect(json).not.toContain("v1:");
  });
});

describe("exclusão de conta (US5)", () => {
  it("recusa sem a confirmação exata e não apaga nada", async () => {
    const { user } = await fullCandidate();
    for (const confirmation of [undefined, "", "excluir", "SIM"]) {
      await expect(deleteMyAccount(user.id, confirmation)).rejects.toSatisfy((err: unknown) => {
        expect((err as ApiError).status).toBe(422);
        expect((err as ApiError).code).toBe("CONFIRMATION_REQUIRED");
        return true;
      });
    }
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
    expect(deletePrivateObjects).not.toHaveBeenCalled();
  });

  it("apaga tudo o que pende do usuário e os objetos do bucket (SC-303)", async () => {
    const { user, candidate, application, job } = await fullCandidate();
    await deleteMyAccount(user.id, "EXCLUIR");

    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
    expect(await prisma.candidate.count({ where: { id: candidate.id } })).toBe(0);
    expect(await prisma.resume.count({ where: { candidateId: candidate.id } })).toBe(0);
    expect(await prisma.application.count({ where: { id: application.id } })).toBe(0);
    expect(await prisma.applicationStageHistory.count({ where: { applicationId: application.id } })).toBe(0);
    expect(await prisma.evaluation.count({ where: { applicationId: application.id } })).toBe(0);
    expect(await prisma.codeDraft.count({ where: { applicationId: application.id } })).toBe(0);
    expect(await prisma.codeSubmission.count({ where: { applicationId: application.id } })).toBe(0);
    expect(deletePrivateObjects).toHaveBeenCalledWith(["resumes/x/obj-1"]);

    // A vaga e o recrutador não são do titular e continuam lá.
    expect(await prisma.job.count({ where: { id: job.id } })).toBe(1);
  });

  it("falha no bucket não impede a exclusão do banco", async () => {
    const { user } = await fullCandidate();
    deletePrivateObjects.mockRejectedValueOnce(new Error("bucket fora do ar"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await deleteMyAccount(user.id, "EXCLUIR");
    } finally {
      spy.mockRestore();
    }
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
  });
});
