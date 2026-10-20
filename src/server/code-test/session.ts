// Spec 005 US2 / RF05 — o candidato resolve o desafio da etapa CODE_TEST.
//
// FR-203: todo acesso parte da candidatura do PRÓPRIO candidato autenticado e da etapa atual
// dela; nenhuma rota aceita challengeId solto. FR-206: o relógio é o do servidor
// (CodeDraft.startedAt + timeLimitMinutes); o navegador só exibe.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, Errors } from "@/lib/errors";
import { decrypt, encrypt } from "@/server/crypto";
import { SandboxUnavailableError } from "@/server/sandbox";
import {
  DEFAULT_TIME_LIMIT_MINUTES,
  MAX_TEST_RUNS,
  STARTER_CODE,
  isCodeTestConfigComplete,
  type CaseOutcome,
  type CodeTestStageConfig,
} from "@/lib/codeTest";
import type { SaveDraftInput } from "@/lib/validation/challenges";
import { parseTestCases, toPublicView, type ChallengePublicView } from "./challenges";
import { kickGrading, resumeIfStale, runCases } from "./grading";

export type CandidateSubmissionStatus = "GRADING" | "GRADED" | "FAILED";

export interface CandidateChallengeView {
  applicationId: string;
  job: { id: string; title: string; company: string };
  challenge: ChallengePublicView;
  allowedLanguages: string[];
  timeLimitMinutes: number;
  startedAt: string;
  deadline: string;
  serverNow: string;
  draft: { language: string; sourceCode: string; savedAt: string };
  testRunCount: number;
  maxTestRuns: number;
  remainingRuns: number;
  submission: { status: CandidateSubmissionStatus; submittedAt: string; submittedBy: "CANDIDATE" | "TIME_EXPIRED" } | null;
}

export interface VisibleRunResult {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  outcome: CaseOutcome;
  diagnostics: string;
}

export interface RunResponse {
  results: VisibleRunResult[];
  testRunCount: number;
  remainingRuns: number;
}

/** Candidato não está (ou não está mais) na etapa de teste de código. */
function notAvailable(): ApiError {
  return Errors.businessRule("NOT_AVAILABLE_YET", "O desafio técnico só fica disponível quando sua candidatura chega a esta etapa.");
}

async function loadContext(userId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, candidate: { userId } },
    include: { currentStage: true, job: { select: { id: true, title: true, company: true } } },
  });
  // Candidatura de outra pessoa responde como inexistente — não confirma que existe.
  if (!application) throw Errors.notFound("Candidatura");

  const submissionAtStage = await findSubmission(application.id, (application.currentStage.config as CodeTestStageConfig)?.challengeId);
  if (application.currentStage.type !== "CODE_TEST" || (application.status !== "IN_PROGRESS" && !submissionAtStage)) {
    throw notAvailable();
  }

  const config = (application.currentStage.config ?? {}) as CodeTestStageConfig;
  if (!isCodeTestConfigComplete(config)) {
    throw Errors.businessRule("CODE_TEST_NOT_CONFIGURED", "O desafio desta etapa ainda não foi configurado pela empresa. Tente mais tarde.");
  }
  const challenge = await prisma.challenge.findUnique({ where: { id: config.challengeId as string } });
  if (!challenge) throw Errors.businessRule("CODE_TEST_NOT_CONFIGURED", "O desafio desta etapa não está mais disponível.");

  const allowedLanguages = (config.languages ?? challenge.languages).filter((l) => challenge.languages.includes(l));
  return {
    application,
    challenge,
    config,
    allowedLanguages,
    timeLimitMinutes: config.timeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES,
    maxTestRuns: config.maxTestRuns ?? MAX_TEST_RUNS,
  };
}

type Context = Awaited<ReturnType<typeof loadContext>>;

function findSubmission(applicationId: string, challengeId: string | undefined) {
  if (!challengeId) return Promise.resolve(null);
  return prisma.codeSubmission.findUnique({ where: { applicationId_challengeId: { applicationId, challengeId } } });
}

function deadlineOf(startedAt: Date, timeLimitMinutes: number): Date {
  return new Date(startedAt.getTime() + timeLimitMinutes * 60_000);
}

/** Abre (ou retoma) o rascunho. A primeira abertura grava o início da prova no servidor. */
async function ensureDraft(ctx: Context, now: Date) {
  const where = { applicationId_challengeId: { applicationId: ctx.application.id, challengeId: ctx.challenge.id } };
  const existing = await prisma.codeDraft.findUnique({ where });
  if (existing) return existing;
  const language = ctx.allowedLanguages[0] ?? ctx.challenge.languages[0] ?? "python";
  try {
    return await prisma.codeDraft.create({
      data: {
        applicationId: ctx.application.id,
        challengeId: ctx.challenge.id,
        stageId: ctx.application.currentStageId,
        language,
        sourceCode: encrypt(STARTER_CODE[language] ?? ""),
        startedAt: now,
      },
    });
  } catch (err) {
    // Duas abas abrindo ao mesmo tempo: a outra criou primeiro.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return prisma.codeDraft.findUniqueOrThrow({ where });
    }
    throw err;
  }
}

/**
 * Cria a submissão a partir do último rascunho salvo. A unicidade é a constraint
 * (applicationId, challengeId) do banco (FR-204), não uma checagem prévia.
 */
async function createSubmission(ctx: Context, submittedBy: "CANDIDATE" | "TIME_EXPIRED") {
  const draft = await prisma.codeDraft.findUniqueOrThrow({
    where: { applicationId_challengeId: { applicationId: ctx.application.id, challengeId: ctx.challenge.id } },
  });
  try {
    const submission = await prisma.codeSubmission.create({
      data: {
        applicationId: ctx.application.id,
        challengeId: ctx.challenge.id,
        language: draft.language,
        sourceCode: draft.sourceCode, // já cifrado (FR-202)
        submittedBy,
      },
    });
    kickGrading(submission.id);
    return submission;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw Errors.conflict("ALREADY_SUBMITTED", "Este desafio já foi submetido. A tentativa é única.");
    }
    throw err;
  }
}

/** RF05-A1: prazo vencido sem submissão manual → submete o último rascunho como TIME_EXPIRED. */
async function expireIfOverdue(ctx: Context, draft: { startedAt: Date }, now: Date): Promise<boolean> {
  if (now <= deadlineOf(draft.startedAt, ctx.timeLimitMinutes)) return false;
  const existing = await findSubmission(ctx.application.id, ctx.challenge.id);
  if (existing) return true;
  try {
    await createSubmission(ctx, "TIME_EXPIRED");
  } catch (err) {
    if (!(err instanceof ApiError && err.code === "ALREADY_SUBMITTED")) throw err;
  }
  return true;
}

function submissionStatus(executionStatus: string): CandidateSubmissionStatus {
  if (executionStatus === "COMPLETED") return "GRADED";
  if (executionStatus === "ERROR") return "FAILED";
  return "GRADING";
}

async function buildView(ctx: Context, now: Date): Promise<CandidateChallengeView> {
  const draft = await prisma.codeDraft.findUniqueOrThrow({
    where: { applicationId_challengeId: { applicationId: ctx.application.id, challengeId: ctx.challenge.id } },
  });
  const submission = await findSubmission(ctx.application.id, ctx.challenge.id);
  if (submission) resumeIfStale(submission, now);

  const publicChallenge = toPublicView(ctx.challenge);
  return {
    applicationId: ctx.application.id,
    job: ctx.application.job,
    challenge: { ...publicChallenge, languages: ctx.allowedLanguages },
    allowedLanguages: ctx.allowedLanguages,
    timeLimitMinutes: ctx.timeLimitMinutes,
    startedAt: draft.startedAt.toISOString(),
    deadline: deadlineOf(draft.startedAt, ctx.timeLimitMinutes).toISOString(),
    serverNow: now.toISOString(),
    draft: { language: draft.language, sourceCode: decrypt(draft.sourceCode), savedAt: draft.updatedAt.toISOString() },
    testRunCount: draft.testRunCount,
    maxTestRuns: ctx.maxTestRuns,
    remainingRuns: Math.max(0, ctx.maxTestRuns - draft.testRunCount),
    submission: submission
      ? {
          status: submissionStatus(submission.executionStatus),
          submittedAt: submission.submittedAt.toISOString(),
          submittedBy: submission.submittedBy,
        }
      : null,
  };
}

export async function openChallenge(userId: string, applicationId: string, now = new Date()): Promise<CandidateChallengeView> {
  const ctx = await loadContext(userId, applicationId);
  const draft = await ensureDraft(ctx, now);
  await expireIfOverdue(ctx, draft, now);
  return buildView(ctx, now);
}

/** Garante que ainda dá para mexer no código: sem submissão e dentro do prazo. */
async function assertWritable(ctx: Context, now: Date) {
  const draft = await ensureDraft(ctx, now);
  if (await findSubmission(ctx.application.id, ctx.challenge.id)) {
    throw Errors.conflict("ALREADY_SUBMITTED", "Este desafio já foi submetido. A tentativa é única.");
  }
  if (await expireIfOverdue(ctx, draft, now)) {
    throw Errors.conflict("TIME_EXPIRED", "O tempo acabou. Seu último rascunho salvo foi submetido automaticamente.");
  }
  return draft;
}

async function writeDraft(ctx: Context, input: SaveDraftInput) {
  if (!ctx.allowedLanguages.includes(input.language)) {
    throw Errors.validation("Linguagem não permitida para este desafio.");
  }
  return prisma.codeDraft.update({
    where: { applicationId_challengeId: { applicationId: ctx.application.id, challengeId: ctx.challenge.id } },
    data: { language: input.language, sourceCode: encrypt(input.sourceCode) },
  });
}

/** Autosave (US2.4). */
export async function saveDraft(userId: string, applicationId: string, input: SaveDraftInput, now = new Date()) {
  const ctx = await loadContext(userId, applicationId);
  await assertWritable(ctx, now);
  const draft = await writeDraft(ctx, input);
  return { savedAt: draft.updatedAt.toISOString() };
}

/**
 * Executa o código contra os casos VISÍVEIS (US2.5–2.7). Respeita o teto de execuções e uma
 * execução simultânea por candidato (FR-207), com trava consultiva do Postgres presa à
 * transação — vale entre instâncias, não só dentro deste processo.
 */
export async function runVisibleTests(
  userId: string,
  applicationId: string,
  input: SaveDraftInput,
  now = new Date(),
): Promise<RunResponse> {
  const ctx = await loadContext(userId, applicationId);
  await assertWritable(ctx, now);
  await writeDraft(ctx, input);

  const lockKey = `code-run:${ctx.application.candidateId}`;
  const visible = parseTestCases(ctx.challenge.testCases)
    .map((c, index) => ({ case: c, index }))
    .filter(({ case: c }) => !c.hidden);

  return prisma.$transaction(
    async (tx) => {
      const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${lockKey})) AS locked`;
      if (!lock?.locked) {
        throw Errors.conflict("RUN_IN_PROGRESS", "Já existe uma execução sua em andamento. Aguarde o resultado dela.");
      }

      const draft = await tx.codeDraft.findUniqueOrThrow({
        where: { applicationId_challengeId: { applicationId: ctx.application.id, challengeId: ctx.challenge.id } },
      });
      if (draft.testRunCount >= ctx.maxTestRuns) {
        throw new ApiError(
          422,
          "TEST_RUNS_EXHAUSTED",
          `Você já usou as ${ctx.maxTestRuns} execuções de teste. A submissão final continua disponível.`,
          { remainingRuns: 0 },
        );
      }

      let results;
      try {
        results = await runCases(visible, input.language, input.sourceCode, ctx.challenge.timeLimitSeconds);
      } catch (err) {
        // Falha da infraestrutura não consome execução do candidato.
        if (err instanceof SandboxUnavailableError) {
          throw new ApiError(503, "SANDBOX_UNAVAILABLE", "O ambiente de execução está indisponível no momento. Seu código foi salvo; tente executar de novo em instantes.");
        }
        throw err;
      }

      const updated = await tx.codeDraft.update({ where: { id: draft.id }, data: { testRunCount: { increment: 1 } } });
      const byIndex = new Map(visible.map(({ case: c, index }) => [index, c]));
      return {
        results: results.map((r) => ({
          index: r.index,
          input: byIndex.get(r.index)?.input ?? "",
          expectedOutput: byIndex.get(r.index)?.expectedOutput ?? "",
          actualOutput: r.actualOutput,
          outcome: r.outcome,
          diagnostics: r.diagnostics.slice(0, 4000),
        })),
        testRunCount: updated.testRunCount,
        remainingRuns: Math.max(0, ctx.maxTestRuns - updated.testRunCount),
      };
    },
    { timeout: 180_000, maxWait: 10_000 },
  );
}

/** Submissão final, única (US2.8–2.9). Salva o código enviado antes de submeter. */
export async function submitChallenge(
  userId: string,
  applicationId: string,
  input: SaveDraftInput,
  now = new Date(),
): Promise<CandidateChallengeView> {
  const ctx = await loadContext(userId, applicationId);
  await assertWritable(ctx, now);
  await writeDraft(ctx, input);
  await createSubmission(ctx, "CANDIDATE");
  return buildView(ctx, now);
}

export interface PendingChallengeItem {
  applicationId: string;
  job: { id: string; title: string; company: string };
  challengeTitle: string | null;
  difficulty: string | null;
  languages: string[];
  timeLimitMinutes: number;
  state: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "NOT_CONFIGURED";
}

/** "Desafios Técnicos" (US2.1): só os desafios das candidaturas do próprio candidato em CODE_TEST. */
export async function listMyChallenges(userId: string): Promise<PendingChallengeItem[]> {
  const applications = await prisma.application.findMany({
    where: { candidate: { userId }, currentStage: { type: "CODE_TEST" } },
    orderBy: { appliedAt: "desc" },
    include: {
      currentStage: true,
      job: { select: { id: true, title: true, company: true } },
      codeDrafts: { select: { challengeId: true } },
      codeSubmissions: { select: { challengeId: true } },
    },
  });

  const challengeIds = applications
    .map((app) => (app.currentStage.config as CodeTestStageConfig)?.challengeId)
    .filter((id): id is string => Boolean(id));
  const challenges = await prisma.challenge.findMany({
    where: { id: { in: challengeIds } },
    select: { id: true, title: true, difficulty: true },
  });
  const byId = new Map(challenges.map((c) => [c.id, c]));

  return applications
    .filter((app) => app.status === "IN_PROGRESS" || app.codeSubmissions.length > 0)
    .map((app) => {
      const config = (app.currentStage.config ?? {}) as CodeTestStageConfig;
      const challenge = config.challengeId ? byId.get(config.challengeId) : undefined;
      const submitted = app.codeSubmissions.some((s) => s.challengeId === config.challengeId);
      const started = app.codeDrafts.some((d) => d.challengeId === config.challengeId);
      return {
        applicationId: app.id,
        job: app.job,
        challengeTitle: challenge?.title ?? null,
        difficulty: challenge?.difficulty ?? null,
        languages: config.languages ?? [],
        timeLimitMinutes: config.timeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES,
        state: !challenge || !isCodeTestConfigComplete(config) ? "NOT_CONFIGURED" : submitted ? "SUBMITTED" : started ? "IN_PROGRESS" : "NOT_STARTED",
      };
    });
}

/**
 * Varredura de prazos vencidos (RF05-A1) para quem fechou a aba e não voltou. A expiração
 * também acontece sob demanda sempre que candidato ou recrutador consultam o desafio.
 */
export async function expireOverdueDrafts(now = new Date()): Promise<number> {
  const drafts = await prisma.codeDraft.findMany({
    where: { application: { status: "IN_PROGRESS", currentStage: { type: "CODE_TEST" } } },
    include: { application: { include: { currentStage: true, candidate: { select: { userId: true } } } } },
  });
  let expired = 0;
  for (const draft of drafts) {
    const config = (draft.application.currentStage.config ?? {}) as CodeTestStageConfig;
    if (config.challengeId !== draft.challengeId) continue;
    const deadline = deadlineOf(draft.startedAt, config.timeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES);
    if (now <= deadline) continue;
    if (await findSubmission(draft.applicationId, draft.challengeId)) continue;
    const ctx = await loadContext(draft.application.candidate.userId, draft.applicationId).catch(() => null);
    if (ctx && (await expireIfOverdue(ctx, draft, now))) expired += 1;
  }
  return expired;
}
