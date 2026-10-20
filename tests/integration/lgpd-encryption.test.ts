// Spec 006, US1 e US3 — CT-RNF05 passo 2 (cifra em repouso) e passo 1 (HTTPS), mais os
// achados L1 (tokens OAuth), L2 (log sem dado pessoal) e L3 (nome do arquivo no bucket).
//
// As colunas são lidas por SQL cru, como faria quem tem um dump do banco: o Prisma Client
// não entra no caminho da leitura.
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/server/crypto";
import { logSafeError, toErrorResponse } from "@/lib/errors";
import { registerCandidate } from "@/server/auth/register";
import { updateProfile } from "@/server/candidates/profile";
import { uploadResume } from "@/server/candidates/resume";
import { createJob, publishJob, setStages } from "@/server/jobs/builder";
import { createChallenge } from "@/server/code-test/challenges";
import { openChallenge, saveDraft, submitChallenge } from "@/server/code-test/session";
import { waitForPendingGradings } from "@/server/code-test/grading";
import { setSandboxForTesting } from "@/server/sandbox";
import { createAdapter, stripOAuthTokens } from "@/server/auth/adapter";
import { buildResumeStorageKey } from "@/server/storage";
import { SECURITY_HEADERS } from "../../next.config";

const uploaded: { key: string; body: Buffer }[] = [];
vi.mock("@/server/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/storage")>();
  return {
    ...real,
    uploadPrivateObject: vi.fn(async (candidateId: string, body: Buffer) => {
      const key = real.buildResumeStorageKey(candidateId);
      uploaded.push({ key, body });
      return { storageKey: key };
    }),
  };
});

afterEach(async () => {
  await waitForPendingGradings();
  setSandboxForTesting(null);
  uploaded.length = 0;
});

function expectCiphertextOf(raw: string | null, plaintext: string) {
  expect(raw).not.toBeNull();
  expect(raw!.startsWith("v1:")).toBe(true);
  expect(raw).not.toContain(plaintext);
  expect(decrypt(raw!)).toBe(plaintext);
}

/** Candidatura já na etapa CODE_TEST, para gravar rascunho e submissão reais. */
async function candidateAtCodeTest() {
  const recruiter = await prisma.user.create({
    data: { name: "R", email: `rec-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
  const challenge = await createChallenge({
    title: "Eco",
    statement: "Devolva a entrada.",
    languages: ["python"],
    difficulty: "EASY",
    timeLimitSeconds: 5,
    testCases: [{ input: "a", expectedOutput: "a", hidden: false }],
  });
  const job = await createJob(recruiter.id, {
    title: "Vaga",
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
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
  const resume = await prisma.resume.create({
    data: { candidateId: candidate.id, storageKey: "k", originalFilename: "cv.pdf", mimeType: "application/pdf", sizeBytes: 1 },
  });
  const application = await prisma.application.create({
    data: { candidateId: candidate.id, jobId: job.id, resumeId: resume.id, currentStageId: published.stages[0]!.id },
  });
  return { user, candidate, application };
}

describe("cifra em repouso (CT-RNF05 passo 2)", () => {
  it("Candidate.phone fica cifrado no banco", async () => {
    const user = await registerCandidate({ name: "Maria", email: "fone@example.com", password: "senhaSegura123" });
    await updateProfile(user.id, { phone: "11987654321" });

    const [row] = await prisma.$queryRaw<{ phone: string | null }[]>`
      SELECT c."phone" FROM "Candidate" c WHERE c."userId" = ${user.id}`;
    expectCiphertextOf(row!.phone, "11987654321");
  });

  it("arquivo do currículo sai cifrado para o bucket, e a chave não leva o nome do arquivo (L3)", async () => {
    const user = await registerCandidate({ name: "Maria", email: "cv@example.com", password: "senhaSegura123" });
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\nMaria Souza CPF 123"), Buffer.alloc(64)]);
    await uploadResume(user.id, { name: "Maria_Souza_CV.pdf", type: "application/pdf", buffer: pdf });

    expect(uploaded).toHaveLength(1);
    const { key, body } = uploaded[0]!;
    expect(key).not.toMatch(/maria|souza|\.pdf/i);
    expect(body.toString("utf8")).not.toContain("Maria Souza");
    expect(Buffer.from(decrypt(body.toString("utf8")), "base64").equals(pdf)).toBe(true);
  });

  it("CodeDraft.sourceCode e CodeSubmission.sourceCode ficam cifrados", async () => {
    setSandboxForTesting({ run: async ({ stdin }) => ({ outcome: "OK", stdout: stdin, diagnostics: "" }) });
    const { user, application } = await candidateAtCodeTest();
    await openChallenge(user.id, application.id);
    await saveDraft(user.id, application.id, { language: "python", sourceCode: "print('rascunho_secreto')" });

    const [draft] = await prisma.$queryRaw<{ sourceCode: string }[]>`
      SELECT d."sourceCode" FROM "CodeDraft" d WHERE d."applicationId" = ${application.id}`;
    expectCiphertextOf(draft!.sourceCode, "print('rascunho_secreto')");

    await submitChallenge(user.id, application.id, { language: "python", sourceCode: "print('final_secreto')" });
    const [submission] = await prisma.$queryRaw<{ sourceCode: string }[]>`
      SELECT s."sourceCode" FROM "CodeSubmission" s WHERE s."applicationId" = ${application.id}`;
    expectCiphertextOf(submission!.sourceCode, "print('final_secreto')");
  });

  it("chave do bucket é só o id do candidato e um UUID", () => {
    expect(buildResumeStorageKey("cand-1")).toMatch(/^resumes\/cand-1\/[0-9a-f-]{36}$/);
  });
});

describe("minimização no vínculo OAuth (L1)", () => {
  const oauthAccount = {
    userId: "u1",
    type: "oauth" as const,
    provider: "github",
    providerAccountId: "123",
    access_token: "gho_segredo",
    refresh_token: "ghr_segredo",
    id_token: "eyJ.segredo",
    expires_at: 1,
    token_type: "bearer" as const,
    scope: "read:user",
  };

  it("descarta tokens e metadados do provedor", () => {
    expect(stripOAuthTokens(oauthAccount)).toEqual({
      userId: "u1",
      type: "oauth",
      provider: "github",
      providerAccountId: "123",
    });
  });

  it("linkAccount do adapter grava a linha sem token", async () => {
    const user = await prisma.user.create({ data: { name: "OAuth", email: "oauth@example.com" } });
    await createAdapter().linkAccount!({ ...oauthAccount, userId: user.id });

    const [row] = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM "Account" a WHERE a."userId" = ${user.id}`;
    expect(row).toMatchObject({ provider: "github", providerAccountId: "123" });
    expect(row!.access_token).toBeNull();
    expect(row!.refresh_token).toBeNull();
    expect(row!.id_token).toBeNull();
  });
});

describe("transporte e logs (US3)", () => {
  it("cabeçalhos de segurança incluem HSTS de pelo menos um ano (CT-RNF05 passo 1)", () => {
    const byName = Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]));
    const maxAge = Number(/max-age=(\d+)/.exec(byName["Strict-Transport-Security"] ?? "")?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
    expect(byName["X-Content-Type-Options"]).toBe("nosniff");
    expect(byName["X-Frame-Options"]).toBe("DENY");
    expect(byName["Referrer-Policy"]).toBeDefined();
  });

  it("erro inesperado vira 500 sem levar a mensagem para o log (L2)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const err = Object.assign(new Error("Argument `email`: maria.souza@example.com is invalid"), { code: "P2009" });
      const res = toErrorResponse(err);
      expect(res.status).toBe(500);

      const logged = spy.mock.calls.flat().map(String).join("\n");
      expect(logged).toContain("P2009");
      expect(logged).not.toContain("maria.souza@example.com");

      logSafeError("teste", "string com maria.souza@example.com");
      expect(spy.mock.calls.flat().map(String).join("\n")).not.toContain("maria.souza@example.com");
    } finally {
      spy.mockRestore();
    }
  });
});
