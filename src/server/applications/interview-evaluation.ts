// Spec 009 (FR-901/FR-903): ficha de entrevista padronizada. Opinião humana, separada de
// Evaluation (resultado automático e imutável, Princípio II). Só RECRUITER/ADMIN — nunca vai
// ao candidato pela interface (Princípio I). Editável só enquanto a candidatura está na etapa.
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { INTERVIEW_STAGES } from "@/lib/processStages";
import { INTERVIEW_CRITERIA, averageScore, validateInterviewScores } from "@/lib/interviewCriteria";
import type { InterviewEvaluationInput } from "@/lib/validation/applications";
import { decryptOrNull, encryptOrNull } from "@/server/crypto";

export interface InterviewEvaluationView {
  id: string;
  evaluatorName: string;
  mine: boolean;
  scores: Record<string, number>;
  average: number | null;
  comment: string | null;
  recommendation: "ADVANCE" | "UNSURE" | "REJECT";
  updatedAt: string;
}

export interface InterviewStageEvaluations {
  stageId: string;
  stageType: string;
  /** A candidatura está nesta etapa agora (a ficha ainda pode ser preenchida/editada). */
  current: boolean;
  /** Média de cada critério entre os avaliadores. */
  averages: Record<string, number | null>;
  evaluations: InterviewEvaluationView[];
}

export async function upsertInterviewEvaluation(
  applicationId: string,
  evaluatorUserId: string,
  input: InterviewEvaluationInput,
): Promise<void> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { status: true, currentStageId: true, currentStage: { select: { type: true } } },
  });
  if (!application) throw Errors.notFound("Candidatura", true);
  if (application.status !== "IN_PROGRESS") {
    throw Errors.conflict("STAGE_CLOSED", "Esta candidatura já saiu da etapa: a ficha não pode mais ser alterada.");
  }
  if (!INTERVIEW_STAGES.includes(application.currentStage.type)) {
    throw Errors.conflict("NOT_INTERVIEW_STAGE", "A ficha só existe nas etapas de entrevista.");
  }
  const problem = validateInterviewScores(application.currentStage.type, input.scores);
  if (problem) throw Errors.validation(problem);

  const data = {
    scores: input.scores,
    comment: encryptOrNull(input.comment?.trim() || null),
    recommendation: input.recommendation,
  };
  await prisma.interviewEvaluation.upsert({
    where: {
      applicationId_stageId_evaluatorUserId: { applicationId, stageId: application.currentStageId, evaluatorUserId },
    },
    create: { applicationId, stageId: application.currentStageId, evaluatorUserId, ...data },
    update: data,
  });
}

/** Fichas da candidatura agrupadas por etapa, na ordem do pipeline. */
export async function listInterviewEvaluations(applicationId: string, viewerUserId: string): Promise<InterviewStageEvaluations[]> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      status: true,
      currentStageId: true,
      interviewEvaluations: {
        orderBy: { createdAt: "asc" },
        include: { evaluator: { select: { name: true } }, stage: { select: { id: true, type: true, order: true } } },
      },
    },
  });
  if (!application) throw Errors.notFound("Candidatura", true);

  const byStage = new Map<string, InterviewStageEvaluations & { order: number }>();
  for (const row of application.interviewEvaluations) {
    const scores = row.scores as Record<string, number>;
    const group = byStage.get(row.stageId) ?? {
      stageId: row.stageId,
      stageType: row.stage.type,
      order: row.stage.order,
      current: application.status === "IN_PROGRESS" && row.stageId === application.currentStageId,
      averages: {},
      evaluations: [],
    };
    group.evaluations.push({
      id: row.id,
      evaluatorName: row.evaluator.name,
      mine: row.evaluatorUserId === viewerUserId,
      scores,
      average: averageScore(Object.values(scores)),
      comment: decryptOrNull(row.comment),
      recommendation: row.recommendation,
      updatedAt: row.updatedAt.toISOString(),
    });
    byStage.set(row.stageId, group);
  }

  return [...byStage.values()]
    .sort((a, b) => a.order - b.order)
    .map((group) => {
      const keys = (INTERVIEW_CRITERIA[group.stageType] ?? []).map((c) => c.key);
      const averages = Object.fromEntries(
        keys.map((key) => [key, averageScore(group.evaluations.map((e) => e.scores[key]).filter((v): v is number => typeof v === "number"))]),
      );
      return { stageId: group.stageId, stageType: group.stageType, current: group.current, averages, evaluations: group.evaluations };
    });
}
