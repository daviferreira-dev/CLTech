// Spec 005 US3 / RF06 — correção automática da submissão contra TODOS os casos, inclusive os
// ocultos. Nunca move a candidatura de etapa (FR-209 / Princípio II): só grava a Evaluation.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logSafeError } from "@/lib/errors";
import { decrypt } from "@/server/crypto";
import { getSandbox, SandboxUnavailableError } from "@/server/sandbox";
import type { CaseOutcome } from "@/lib/codeTest";
import { parseTestCases, type StoredTestCase } from "./challenges";

/** Uma retentativa automática apenas sobre falha técnica (RF06-E1, FR-205). */
export const MAX_GRADING_RETRIES = 1;

/** Submissão parada na fila há mais que isto é reenfileirada ao ser consultada. */
const STALE_QUEUE_MS = 60_000;

export interface CaseResult {
  index: number;
  hidden: boolean;
  outcome: CaseOutcome;
  actualOutput: string;
  diagnostics: string;
}

/** Saídas iguais ignorando espaços/quebras de linha no fim de cada linha e do texto. */
export function sameOutput(actual: string, expected: string): boolean {
  const normalize = (value: string) =>
    value
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
  return normalize(actual) === normalize(expected);
}

/** Executa casos no sandbox. Falha de infraestrutura propaga como SandboxUnavailableError. */
export async function runCases(
  cases: Array<{ case: StoredTestCase; index: number }>,
  language: string,
  sourceCode: string,
  timeLimitSeconds: number,
): Promise<CaseResult[]> {
  const sandbox = getSandbox();
  const results: CaseResult[] = [];
  for (const { case: testCase, index } of cases) {
    const run = await sandbox.run({ language, sourceCode, stdin: testCase.input, timeLimitSeconds });
    const outcome: CaseOutcome =
      run.outcome === "OK" ? (sameOutput(run.stdout, testCase.expectedOutput) ? "PASSED" : "FAILED") : run.outcome;
    results.push({ index, hidden: testCase.hidden, outcome, actualOutput: run.stdout, diagnostics: run.diagnostics });
  }
  return results;
}

/**
 * Corrige uma submissão. Idempotente: só quem consegue mover QUEUED → RUNNING corrige, então
 * dois disparos simultâneos não geram duas avaliações.
 */
export async function gradeSubmission(submissionId: string): Promise<void> {
  const claimed = await prisma.codeSubmission.updateMany({
    where: { id: submissionId, executionStatus: "QUEUED" },
    data: { executionStatus: "RUNNING" },
  });
  if (claimed.count === 0) return;

  const submission = await prisma.codeSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { challenge: true },
  });
  const cases = parseTestCases(submission.challenge.testCases).map((c, index) => ({ case: c, index }));
  const sourceCode = decrypt(submission.sourceCode);

  let retryCount = submission.retryCount;
  for (;;) {
    try {
      const results = await runCases(cases, submission.language, sourceCode, submission.challenge.timeLimitSeconds);
      await recordEvaluation(submission.id, submission.applicationId, submission.language, results);
      return;
    } catch (err) {
      if (!(err instanceof SandboxUnavailableError)) throw err;
      // Erro do código do candidato nunca chega aqui: vira resultado de caso, não falha técnica.
      if (retryCount >= MAX_GRADING_RETRIES) {
        await prisma.codeSubmission.update({ where: { id: submission.id }, data: { executionStatus: "ERROR" } });
        // Notificação à equipe técnica: o log de erro é o canal monitorado (não há outro hoje).
        console.error(`[code-test] Falha persistente do sandbox na submissão ${submission.id}: ${err.message}`);
        return;
      }
      retryCount += 1;
      await prisma.codeSubmission.update({ where: { id: submission.id }, data: { retryCount } });
    }
  }
}

async function recordEvaluation(submissionId: string, applicationId: string, language: string, results: CaseResult[]) {
  const passed = results.filter((r) => r.outcome === "PASSED").length;
  const total = results.length;
  const score = total === 0 ? 0 : Math.round((passed / total) * 100);

  await prisma.$transaction(async (tx) => {
    const evaluation = await tx.evaluation.create({
      data: {
        applicationId,
        type: "CODE_TEST",
        score,
        // Casos identificados por índice e visibilidade, nunca pelo conteúdo (US3.3).
        justification: {
          language,
          passed,
          total,
          compileError: results.some((r) => r.outcome === "COMPILE_ERROR"),
          cases: results.map((r) => ({ index: r.index, hidden: r.hidden, outcome: r.outcome })),
        } as Prisma.InputJsonValue,
      },
    });
    await tx.codeSubmission.update({
      where: { id: submissionId },
      data: { executionStatus: "COMPLETED", evaluationId: evaluation.id },
    });
  });
}

const inFlight = new Set<Promise<void>>();

/** Dispara a correção sem bloquear a resposta (mesmo padrão do recálculo de match). */
export function kickGrading(submissionId: string): void {
  const task = gradeSubmission(submissionId)
    .catch((err) => logSafeError(`code-test ${submissionId}`, err))
    .finally(() => inFlight.delete(task));
  inFlight.add(task);
}

/** Só para testes: espera as correções disparadas em segundo plano terminarem. */
export async function waitForPendingGradings(): Promise<void> {
  while (inFlight.size > 0) await Promise.all([...inFlight]);
}

/** Reenfileira uma submissão esquecida na fila (processo que morreu antes de corrigir). */
export function resumeIfStale(submission: { id: string; executionStatus: string; submittedAt: Date }, now = new Date()) {
  if (submission.executionStatus === "QUEUED" && now.getTime() - submission.submittedAt.getTime() > STALE_QUEUE_MS) {
    kickGrading(submission.id);
  }
}
