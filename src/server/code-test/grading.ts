// Spec 005 US3 / RF06 — correção automática da submissão contra TODOS os casos, inclusive os
// ocultos. Nunca move a candidatura de etapa (FR-209 / Princípio II): só grava a Evaluation.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logSafeError } from "@/lib/errors";
import { decrypt } from "@/server/crypto";
import { canGrade, getSandbox, SandboxUnavailableError } from "@/server/sandbox";
import type { CaseOutcome } from "@/lib/codeTest";
import { parseTestCases, type StoredTestCase } from "./challenges";
import { keepAlive } from "@/server/background";

/** Uma retentativa automática apenas sobre falha técnica (RF06-E1, FR-205). */
export const MAX_GRADING_RETRIES = 1;

/** Submissão parada na fila há mais que isto é reenfileirada ao ser consultada. */
const STALE_QUEUE_MS = 60_000;

/** RUNNING há mais que isto = processo morreu no meio da correção; volta para a fila. */
const STALE_RUNNING_MS = 15 * 60_000;

/**
 * Intervalo entre rodadas de correção de uma submissão em ERROR. ERROR não é final: quando o
 * sandbox volta, a próxima consulta (candidato ou recrutador) reenfileira a submissão.
 */
export const ERROR_RETRY_MS = 5 * 60_000;

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
    data: { executionStatus: "RUNNING", gradingStartedAt: new Date() },
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
        // O log de erro é o único canal de alerta hoje. A submissão volta para a fila em
        // ERROR_RETRY_MS, na próxima consulta com o sandbox disponível (resumeIfStale).
        console.error(`[code-test] Falha persistente do sandbox na submissão ${submission.id}: ${err.message}`);
        return;
      }
      retryCount += 1;
      await prisma.codeSubmission.update({ where: { id: submission.id }, data: { retryCount } });
    }
  }
}

// Saída gigante (loop imprimindo) não deve inflar a avaliação.
const MAX_STORED_OUTPUT_CHARS = 2_000;

function clip(value: string): string {
  return value.length > MAX_STORED_OUTPUT_CHARS ? `${value.slice(0, MAX_STORED_OUTPUT_CHARS)}\n… (cortado)` : value;
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
        // Entrada e saída esperada ficam no Challenge (imutável após uso) e são juntadas pelo
        // índice no relatório; aqui só o que é desta execução. Só o recrutador lê (report.ts).
        justification: {
          language,
          passed,
          total,
          compileError: results.some((r) => r.outcome === "COMPILE_ERROR"),
          cases: results.map((r) => ({
            index: r.index,
            hidden: r.hidden,
            outcome: r.outcome,
            actualOutput: clip(r.actualOutput),
            diagnostics: clip(r.diagnostics),
          })),
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
  keepAlive(task);
}

/** Só para testes: espera as correções disparadas em segundo plano terminarem. */
export async function waitForPendingGradings(): Promise<void> {
  while (inFlight.size > 0) await Promise.all([...inFlight]);
}

/**
 * Destrava submissões paradas, chamado sempre que alguém consulta a submissão:
 *  - QUEUED esquecida na fila (processo morreu antes de começar);
 *  - RUNNING há muito tempo (processo morreu no meio da correção);
 *  - ERROR, depois de ERROR_RETRY_MS e só se o sandbox atual consegue rodar a linguagem.
 * A troca de estado é condicional (updateMany com o estado esperado), então consultas
 * simultâneas reenfileiram uma vez só.
 */
export function resumeIfStale(
  submission: { id: string; executionStatus: string; submittedAt: Date; gradingStartedAt: Date | null; language: string },
  now = new Date(),
) {
  const since = (date: Date) => now.getTime() - date.getTime();
  const lastAttempt = submission.gradingStartedAt ?? submission.submittedAt;

  if (submission.executionStatus === "QUEUED" && since(submission.submittedAt) > STALE_QUEUE_MS) {
    kickGrading(submission.id);
  } else if (submission.executionStatus === "RUNNING" && since(lastAttempt) > STALE_RUNNING_MS) {
    requeue(submission.id, "RUNNING", lastAttempt);
  } else if (submission.executionStatus === "ERROR" && since(lastAttempt) > ERROR_RETRY_MS && canGrade(submission.language)) {
    requeue(submission.id, "ERROR", lastAttempt);
  }
}

function requeue(submissionId: string, from: "RUNNING" | "ERROR", lastAttempt: Date): void {
  const task = prisma.codeSubmission
    .updateMany({
      // gradingStartedAt na condição: se outra consulta já reenfileirou, esta não faz nada.
      where: { id: submissionId, executionStatus: from, OR: [{ gradingStartedAt: lastAttempt }, { gradingStartedAt: null }] },
      // Nova rodada ganha de novo a retentativa automática (RF06-E1 vale por rodada).
      data: { executionStatus: "QUEUED", retryCount: 0 },
    })
    .then((res) => {
      if (res.count > 0) kickGrading(submissionId);
    })
    .catch((err) => logSafeError(`code-test requeue ${submissionId}`, err));
  inFlight.add(task);
  void task.finally(() => inFlight.delete(task));
  keepAlive(task);
}
