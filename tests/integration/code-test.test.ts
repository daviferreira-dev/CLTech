// Spec 005 — teste técnico (RF05/RF06). Sandbox falso: o "código" é um comando que o
// fake interpreta, para os testes não dependerem da VM do Judge0.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { encrypt } from "@/server/crypto";
import { createJob, publishJob, setStages } from "@/server/jobs/builder";
import { createChallenge, listChallenges, updateChallenge } from "@/server/code-test/challenges";
import { openChallenge, runVisibleTests, saveDraft, submitChallenge } from "@/server/code-test/session";
import { gradeSubmission, waitForPendingGradings } from "@/server/code-test/grading";
import { getApplicationDetail } from "@/server/applications/detail";
import { setSandboxForTesting, SandboxUnavailableError, type Sandbox, type SandboxRunInput } from "@/server/sandbox";
import { MAX_TEST_RUNS } from "@/lib/codeTest";

const HIDDEN_MARKER = "SEGREDO_OCULTO_7f3a";

/**
 * Programas do sandbox falso:
 *  ECHO  → devolve a entrada; SUM → soma os inteiros; BROKEN → erro de compilação;
 *  INFRA → falha de infraestrutura; SLOW → ECHO com atraso (para testar concorrência).
 */
class FakeSandbox implements Sandbox {
  calls = 0;
  async run({ sourceCode, stdin }: SandboxRunInput) {
    this.calls += 1;
    const program = sourceCode.trim();
    if (program === "INFRA") throw new SandboxUnavailableError("fake fora do ar");
    if (program === "BROKEN") return { outcome: "COMPILE_ERROR" as const, stdout: "", diagnostics: "SyntaxError" };
    if (program === "SLOW") await new Promise((resolve) => setTimeout(resolve, 400));
    if (program === "SUM") {
      const sum = stdin.trim().split(/\s+/).filter(Boolean).map(Number).reduce((a, b) => a + b, 0);
      return { outcome: "OK" as const, stdout: `${sum}\n`, diagnostics: "" };
    }
    return { outcome: "OK" as const, stdout: stdin, diagnostics: "" };
  }
}

let sandbox: FakeSandbox;

beforeEach(() => {
  sandbox = new FakeSandbox();
  setSandboxForTesting(sandbox);
});

afterEach(async () => {
  await waitForPendingGradings();
  setSandboxForTesting(null);
});

const JOB_INPUT = {
  title: "Vaga com teste de código",
  description: "Descrição",
  company: "3aq",
  location: "Remoto",
  workMode: "REMOTE" as const,
  seniority: "JUNIOR" as const,
  technologies: ["TypeScript"],
  minimumRequirements: "TypeScript",
};

async function makeChallenge() {
  // Casos visíveis passam com SUM; o oculto exige "1 1" → 3, que SUM erra de propósito.
  return createChallenge({
    title: "Soma",
    statement: "Some os números.",
    languages: ["python", "javascript"],
    difficulty: "EASY",
    timeLimitSeconds: 5,
    testCases: [
      { input: "1 2", expectedOutput: "3", hidden: false },
      { input: "10 -4", expectedOutput: "6", hidden: false },
      { input: `0 ${HIDDEN_MARKER.length}`, expectedOutput: String(HIDDEN_MARKER.length), hidden: true },
      { input: `1 1 ${HIDDEN_MARKER}`, expectedOutput: `3 ${HIDDEN_MARKER}`, hidden: true },
    ],
  });
}

/** Cria vaga RESUME_ANALYSIS → CODE_TEST e uma candidatura já na etapa de código. */
async function setup({ atCodeTest = true, timeLimitMinutes = 60 } = {}) {
  const recruiter = await prisma.user.create({
    data: { name: "Recrutador", email: `rec-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
  const challenge = await makeChallenge();
  const job = await createJob(recruiter.id, JOB_INPUT);
  await setStages(job.id, {
    stages: [
      { type: "RESUME_ANALYSIS" },
      { type: "CODE_TEST", config: { challengeId: challenge.id, languages: ["python"], timeLimitMinutes } },
    ],
  });
  const published = await publishJob(job.id);

  const user = await prisma.user.create({
    data: { name: "Candidata", email: `cand-${Date.now()}-${Math.random()}@example.com`, role: "CANDIDATE" },
  });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  const resume = await prisma.resume.create({
    data: { candidateId: candidate.id, storageKey: "k", originalFilename: "cv.pdf", mimeType: "application/pdf", sizeBytes: 1 },
  });
  const stage = published.stages[atCodeTest ? 1 : 0]!;
  const application = await prisma.application.create({
    data: { candidateId: candidate.id, jobId: job.id, resumeId: resume.id, currentStageId: stage.id },
  });
  return { user, candidate, application, challenge, job: published };
}

async function expectApiError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe(code);
    return true;
  });
}

describe("configuração da etapa CODE_TEST (US1)", () => {
  it("recusa publicar com etapa de código sem desafio (INCOMPLETE_JOB)", async () => {
    const recruiter = await prisma.user.create({ data: { name: "R", email: `r-${Date.now()}@example.com`, role: "RECRUITER" } });
    const job = await createJob(recruiter.id, JOB_INPUT);
    await setStages(job.id, { stages: [{ type: "CODE_TEST" }] });
    await expect(publishJob(job.id)).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).code).toBe("INCOMPLETE_JOB");
      expect((err as ApiError).details?.missing).toContain("codeTest");
      return true;
    });
  });

  it("recusa linguagem fora das aceitas pelo desafio", async () => {
    const recruiter = await prisma.user.create({ data: { name: "R", email: `r-${Date.now()}@example.com`, role: "RECRUITER" } });
    const challenge = await makeChallenge();
    const job = await createJob(recruiter.id, JOB_INPUT);
    await expectApiError(
      setStages(job.id, { stages: [{ type: "CODE_TEST", config: { challengeId: challenge.id, languages: ["go"], timeLimitMinutes: 30 } }] }),
      "VALIDATION_ERROR",
    );
  });

  it("desafio em uso não aceita mudar casos de teste (US4.2)", async () => {
    const { challenge } = await setup();
    await expectApiError(updateChallenge(challenge.id, { testCases: [{ input: "", expectedOutput: "", hidden: false }] }), "CHALLENGE_IN_USE");
    // Corrigir o título continua permitido.
    await expect(updateChallenge(challenge.id, { title: "Soma de inteiros" })).resolves.toMatchObject({ title: "Soma de inteiros" });
  });
});

describe("acesso ao desafio (US2.1–2.3, FR-203, FR-206)", () => {
  it("só abre na etapa CODE_TEST da própria candidatura", async () => {
    const early = await setup({ atCodeTest: false });
    await expectApiError(openChallenge(early.user.id, early.application.id), "NOT_AVAILABLE_YET");

    const other = await setup();
    await expectApiError(openChallenge(early.user.id, other.application.id), "NOT_FOUND");
  });

  it("o início da prova é gravado no servidor e não reinicia ao reabrir", async () => {
    const { user, application } = await setup();
    const t0 = new Date("2026-10-20T12:00:00Z");
    const first = await openChallenge(user.id, application.id, t0);
    const again = await openChallenge(user.id, application.id, new Date("2026-10-20T12:10:00Z"));
    expect(again.startedAt).toBe(first.startedAt);
    expect(again.deadline).toBe(new Date(t0.getTime() + 60 * 60_000).toISOString());
  });

  it("autosave cifra o código em repouso e o recupera (FR-202)", async () => {
    const { user, application, challenge } = await setup();
    await openChallenge(user.id, application.id);
    await saveDraft(user.id, application.id, { language: "python", sourceCode: "print('olá')" });

    const stored = await prisma.codeDraft.findUniqueOrThrow({
      where: { applicationId_challengeId: { applicationId: application.id, challengeId: challenge.id } },
    });
    expect(stored.sourceCode).not.toContain("olá");
    expect(stored.sourceCode.startsWith("v1:")).toBe(true);
    expect((await openChallenge(user.id, application.id)).draft.sourceCode).toBe("print('olá')");
  });
});

describe("casos ocultos nunca saem do servidor (SC-203, FR-201)", () => {
  it("nenhuma resposta do fluxo contém o conteúdo dos casos ocultos", async () => {
    const { user, application } = await setup();
    const bodies: unknown[] = [];
    bodies.push(await listChallenges());
    bodies.push(await openChallenge(user.id, application.id));
    bodies.push(await runVisibleTests(user.id, application.id, { language: "python", sourceCode: "SUM" }));
    bodies.push(await submitChallenge(user.id, application.id, { language: "python", sourceCode: "SUM" }));
    await waitForPendingGradings();
    bodies.push(await getApplicationDetail(application.id));

    for (const body of bodies) expect(JSON.stringify(body)).not.toContain(HIDDEN_MARKER);
  });
});

describe("execuções de teste (US2.5–2.7, FR-207)", () => {
  it("executa só os casos visíveis e conta a execução", async () => {
    const { user, application } = await setup();
    await openChallenge(user.id, application.id);
    const result = await runVisibleTests(user.id, application.id, { language: "python", sourceCode: "SUM" });
    expect(result.results.map((r) => r.outcome)).toEqual(["PASSED", "PASSED"]);
    expect(result.testRunCount).toBe(1);
    expect(result.remainingRuns).toBe(MAX_TEST_RUNS - 1);
  });

  it("recusa além do teto, mas a submissão final continua disponível", async () => {
    const { user, application, challenge } = await setup();
    await openChallenge(user.id, application.id);
    await prisma.codeDraft.update({
      where: { applicationId_challengeId: { applicationId: application.id, challengeId: challenge.id } },
      data: { testRunCount: MAX_TEST_RUNS },
    });
    await expectApiError(runVisibleTests(user.id, application.id, { language: "python", sourceCode: "SUM" }), "TEST_RUNS_EXHAUSTED");
    await expect(submitChallenge(user.id, application.id, { language: "python", sourceCode: "SUM" })).resolves.toBeTruthy();
  });

  it("nunca duas execuções simultâneas do mesmo candidato", async () => {
    const { user, application } = await setup();
    await openChallenge(user.id, application.id);
    const results = await Promise.allSettled([
      runVisibleTests(user.id, application.id, { language: "python", sourceCode: "SLOW" }),
      runVisibleTests(user.id, application.id, { language: "python", sourceCode: "SLOW" }),
    ]);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0]!.reason as ApiError).code).toBe("RUN_IN_PROGRESS");
  });

  it("falha do sandbox não consome execução do candidato", async () => {
    const { user, application } = await setup();
    await openChallenge(user.id, application.id);
    await expectApiError(runVisibleTests(user.id, application.id, { language: "python", sourceCode: "INFRA" }), "SANDBOX_UNAVAILABLE");
    expect((await openChallenge(user.id, application.id)).testRunCount).toBe(0);
  });
});

describe("submissão única (SC-202, FR-204)", () => {
  it("a segunda submissão é recusada, inclusive direto no banco", async () => {
    const { user, application, challenge } = await setup();
    await openChallenge(user.id, application.id);
    await submitChallenge(user.id, application.id, { language: "python", sourceCode: "SUM" });
    await expectApiError(submitChallenge(user.id, application.id, { language: "python", sourceCode: "ECHO" }), "ALREADY_SUBMITTED");

    await expect(
      prisma.codeSubmission.create({
        data: { applicationId: application.id, challengeId: challenge.id, language: "python", sourceCode: encrypt("x") },
      }),
    ).rejects.toSatisfy((err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002");
    expect(await prisma.codeSubmission.count({ where: { applicationId: application.id } })).toBe(1);
  });
});

describe("tempo esgotado (SC-204, RF05-A1)", () => {
  it("submete o último rascunho salvo como TIME_EXPIRED", async () => {
    const { user, application, challenge } = await setup({ timeLimitMinutes: 30 });
    const t0 = new Date("2026-10-20T12:00:00Z");
    await openChallenge(user.id, application.id, t0);
    await saveDraft(user.id, application.id, { language: "python", sourceCode: "SUM" }, new Date("2026-10-20T12:20:00Z"));

    // Depois do prazo: escrever é recusado e o rascunho vira submissão automática.
    await expectApiError(
      saveDraft(user.id, application.id, { language: "python", sourceCode: "ECHO" }, new Date("2026-10-20T12:31:00Z")),
      "TIME_EXPIRED",
    );
    const view = await openChallenge(user.id, application.id, new Date("2026-10-20T12:32:00Z"));
    expect(view.submission?.submittedBy).toBe("TIME_EXPIRED");

    await waitForPendingGradings();
    const submission = await prisma.codeSubmission.findUniqueOrThrow({
      where: { applicationId_challengeId: { applicationId: application.id, challengeId: challenge.id } },
    });
    expect(submission.submittedBy).toBe("TIME_EXPIRED");
    expect(submission.executionStatus).toBe("COMPLETED");
  });
});

describe("correção automática (US3, SC-201, SC-205)", () => {
  it("gera Evaluation CODE_TEST contando os ocultos e não move a candidatura (FR-209)", async () => {
    const { user, application } = await setup();
    await openChallenge(user.id, application.id);
    await submitChallenge(user.id, application.id, { language: "python", sourceCode: "SUM" });
    await waitForPendingGradings();

    const evaluation = await prisma.evaluation.findFirstOrThrow({ where: { applicationId: application.id, type: "CODE_TEST" } });
    // SUM acerta os 2 visíveis e o 1º oculto; erra o 2º oculto (tem texto na entrada).
    expect(evaluation.score).toBe(75);
    const justification = evaluation.justification as { cases: Array<{ index: number; hidden: boolean; outcome: string }> };
    expect(justification.cases.filter((c) => c.hidden).map((c) => c.index)).toEqual([2, 3]);

    const after = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(after.currentStageId).toBe(application.currentStageId);
    expect(after.status).toBe("IN_PROGRESS");
  });

  it("falha do sandbox reprocessa uma vez e só uma vez", async () => {
    const { user, application, challenge } = await setup();
    await openChallenge(user.id, application.id);
    await submitChallenge(user.id, application.id, { language: "python", sourceCode: "INFRA" });
    await waitForPendingGradings();

    const submission = await prisma.codeSubmission.findUniqueOrThrow({
      where: { applicationId_challengeId: { applicationId: application.id, challengeId: challenge.id } },
    });
    expect(submission.retryCount).toBe(1);
    expect(submission.executionStatus).toBe("ERROR");
    expect(sandbox.calls).toBe(2); // tentativa original + uma retentativa
    expect(await prisma.evaluation.count({ where: { applicationId: application.id, type: "CODE_TEST" } })).toBe(0);

    const report = (await getApplicationDetail(application.id)).codeTest;
    expect(report.status).toBe("FAILED");
  });

  it("erro de compilação do candidato vira nota, sem consumir retentativa", async () => {
    const { user, application, challenge } = await setup();
    await openChallenge(user.id, application.id);
    await submitChallenge(user.id, application.id, { language: "python", sourceCode: "BROKEN" });
    await waitForPendingGradings();

    const submission = await prisma.codeSubmission.findUniqueOrThrow({
      where: { applicationId_challengeId: { applicationId: application.id, challengeId: challenge.id } },
      include: { evaluation: true },
    });
    expect(submission.retryCount).toBe(0);
    expect(submission.executionStatus).toBe("COMPLETED");
    expect(submission.evaluation?.score).toBe(0);
  });

  it("corrigir de novo a mesma submissão não cria segunda avaliação", async () => {
    const { user, application } = await setup();
    await openChallenge(user.id, application.id);
    const view = await submitChallenge(user.id, application.id, { language: "python", sourceCode: "SUM" });
    await waitForPendingGradings();
    const submission = await prisma.codeSubmission.findFirstOrThrow({ where: { applicationId: view.applicationId } });
    await gradeSubmission(submission.id);
    expect(await prisma.evaluation.count({ where: { applicationId: application.id, type: "CODE_TEST" } })).toBe(1);
  });
});
