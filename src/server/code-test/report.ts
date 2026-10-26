// Spec 005 US3.6 — o que o recrutador vê do teste técnico no relatório da candidatura:
// nota, cada caso (entrada, saída esperada, saída obtida, erro), linguagem, tempo gasto e o
// código submetido. Inclui os casos ocultos: o recrutador precisa entender a nota, e esta
// resposta só existe na rota do recrutador — ao candidato eles continuam nunca saindo (FR-201).
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/server/crypto";
import { DEFAULT_TIME_LIMIT_MINUTES, type CaseOutcome, type CodeTestStageConfig } from "@/lib/codeTest";
import { parseTestCases } from "./challenges";
import { resumeIfStale } from "./grading";
import { expireOverdueDrafts } from "./session";

export type CodeTestReport =
  | { status: "NOT_APPLICABLE" }
  | { status: "NOT_STARTED"; challengeTitle: string | null }
  | { status: "IN_PROGRESS"; challengeTitle: string; startedAt: string; deadline: string }
  | { status: "GRADING" | "FAILED"; challengeTitle: string; submittedAt: string; submittedBy: string; language: string }
  | {
      status: "COMPLETED";
      challengeTitle: string;
      score: number;
      passed: number;
      total: number;
      cases: CodeTestCaseReport[];
      language: string;
      submittedAt: string;
      submittedBy: string;
      timeSpentSeconds: number | null;
      sourceCode: string;
    };

export interface CodeTestCaseReport {
  index: number;
  hidden: boolean;
  outcome: CaseOutcome;
  input: string;
  expectedOutput: string;
  /** null em avaliações anteriores à gravação da saída por caso. */
  actualOutput: string | null;
  diagnostics: string | null;
}

interface StoredCaseResult {
  index: number;
  hidden: boolean;
  outcome: CaseOutcome;
  actualOutput?: string;
  diagnostics?: string;
}

export async function getCodeTestReport(applicationId: string, now = new Date()): Promise<CodeTestReport> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { job: { select: { stages: { where: { type: "CODE_TEST" }, orderBy: { order: "asc" }, select: { config: true } } } } },
  });
  const stage = application?.job.stages[0];
  if (!stage) return { status: "NOT_APPLICABLE" };

  const config = (stage.config ?? {}) as CodeTestStageConfig;
  if (!config.challengeId) return { status: "NOT_STARTED", challengeTitle: null };
  const challenge = await prisma.challenge.findUnique({ where: { id: config.challengeId }, select: { id: true, title: true, testCases: true } });
  if (!challenge) return { status: "NOT_STARTED", challengeTitle: null };

  const key = { applicationId_challengeId: { applicationId, challengeId: challenge.id } };
  let submission = await prisma.codeSubmission.findUnique({ where: key, include: { evaluation: true } });
  const draft = await prisma.codeDraft.findUnique({ where: key });

  if (!submission && draft) {
    const deadline = new Date(draft.startedAt.getTime() + (config.timeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES) * 60_000);
    if (now > deadline) {
      // Prazo vencido e candidato sumiu: o relatório já mostra a submissão automática.
      await expireOverdueDrafts(now);
      submission = await prisma.codeSubmission.findUnique({ where: key, include: { evaluation: true } });
    } else {
      return { status: "IN_PROGRESS", challengeTitle: challenge.title, startedAt: draft.startedAt.toISOString(), deadline: deadline.toISOString() };
    }
  }
  if (!submission) return { status: "NOT_STARTED", challengeTitle: challenge.title };

  resumeIfStale(submission, now);
  const base = {
    challengeTitle: challenge.title,
    submittedAt: submission.submittedAt.toISOString(),
    submittedBy: submission.submittedBy,
    language: submission.language,
  };
  if (submission.executionStatus === "ERROR") return { status: "FAILED", ...base };
  if (submission.executionStatus !== "COMPLETED" || !submission.evaluation) return { status: "GRADING", ...base };

  const justification = submission.evaluation.justification as {
    passed?: number;
    total?: number;
    cases?: StoredCaseResult[];
  };
  // Casos do desafio não mudam depois do primeiro uso (challenges.ts), então o índice casa.
  const testCases = parseTestCases(challenge.testCases);
  return {
    status: "COMPLETED",
    ...base,
    score: submission.evaluation.score,
    passed: justification.passed ?? 0,
    total: justification.total ?? 0,
    cases: (justification.cases ?? []).map((c) => ({
      index: c.index,
      hidden: c.hidden,
      outcome: c.outcome,
      input: testCases[c.index]?.input ?? "",
      expectedOutput: testCases[c.index]?.expectedOutput ?? "",
      actualOutput: c.actualOutput ?? null,
      diagnostics: c.diagnostics ?? null,
    })),
    timeSpentSeconds: draft ? Math.max(0, Math.round((submission.submittedAt.getTime() - draft.startedAt.getTime()) / 1000)) : null,
    sourceCode: decrypt(submission.sourceCode),
  };
}
