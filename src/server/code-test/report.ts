// Spec 005 US3.6 — o que o recrutador vê do teste técnico no relatório da candidatura:
// nota, casos aprovados/reprovados, linguagem, tempo gasto e o código submetido. Casos
// ocultos aparecem só por índice e resultado (FR-201).
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/server/crypto";
import { DEFAULT_TIME_LIMIT_MINUTES, type CaseOutcome, type CodeTestStageConfig } from "@/lib/codeTest";
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
      cases: Array<{ index: number; hidden: boolean; outcome: CaseOutcome }>;
      language: string;
      submittedAt: string;
      submittedBy: string;
      timeSpentSeconds: number | null;
      sourceCode: string;
    };

export async function getCodeTestReport(applicationId: string, now = new Date()): Promise<CodeTestReport> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { job: { select: { stages: { where: { type: "CODE_TEST" }, orderBy: { order: "asc" }, select: { config: true } } } } },
  });
  const stage = application?.job.stages[0];
  if (!stage) return { status: "NOT_APPLICABLE" };

  const config = (stage.config ?? {}) as CodeTestStageConfig;
  if (!config.challengeId) return { status: "NOT_STARTED", challengeTitle: null };
  const challenge = await prisma.challenge.findUnique({ where: { id: config.challengeId }, select: { id: true, title: true } });
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
    cases?: Array<{ index: number; hidden: boolean; outcome: CaseOutcome }>;
  };
  return {
    status: "COMPLETED",
    ...base,
    score: submission.evaluation.score,
    passed: justification.passed ?? 0,
    total: justification.total ?? 0,
    cases: justification.cases ?? [],
    timeSpentSeconds: draft ? Math.max(0, Math.round((submission.submittedAt.getTime() - draft.startedAt.getTime()) / 1000)) : null,
    sourceCode: decrypt(submission.sourceCode),
  };
}
