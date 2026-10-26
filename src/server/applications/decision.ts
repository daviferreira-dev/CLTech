// RF08 / FR-049 / FR-050 — avançar/reprovar. Nunca aceita nem grava score (Princípio II).
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

export interface DecisionResult {
  currentStage: { type: string; order: number };
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
}

export async function recordDecision(
  applicationId: string,
  decidedByUserId: string,
  decision: "ADVANCE" | "REJECT",
): Promise<DecisionResult> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      currentStage: true,
      job: { include: { stages: { orderBy: { order: "asc" } } } },
    },
  });
  if (!application) throw Errors.notFound("Candidatura");
  if (application.status !== "IN_PROGRESS") {
    throw Errors.conflict("APPLICATION_CLOSED", "Esta candidatura já foi decidida.");
  }

  const now = new Date();

  if (decision === "REJECT") {
    await prisma.$transaction([
      prisma.application.update({ where: { id: applicationId }, data: { status: "REJECTED" } }),
      prisma.applicationStageHistory.updateMany({
        where: { applicationId, stageId: application.currentStageId, exitedAt: null },
        data: { exitedAt: now, decidedByUserId },
      }),
    ]);
    return { currentStage: { type: application.currentStage.type, order: application.currentStage.order }, status: "REJECTED" };
  }

  const nextStage = application.job.stages.find((stage) => stage.order === application.currentStage.order + 1);

  if (!nextStage) {
    // Última etapa (ex.: proposta final) — avançar aprova de fato. A vaga foi preenchida:
    // encerra a vaga e reprova quem ainda estava em andamento nela, tudo na mesma transação.
    await prisma.$transaction(async (tx) => {
      // O UPDATE trava a linha da vaga: duas aprovações simultâneas na mesma vaga não passam.
      const closed = await tx.job.updateMany({
        where: { id: application.jobId, status: { not: "CLOSED" } },
        data: { status: "CLOSED" },
      });
      if (closed.count === 0) {
        throw Errors.conflict("JOB_CLOSED", "Esta vaga já foi encerrada com outro candidato aprovado.");
      }

      await tx.application.update({ where: { id: applicationId }, data: { status: "APPROVED" } });
      await tx.applicationStageHistory.updateMany({
        where: { applicationId, stageId: application.currentStageId, exitedAt: null },
        data: { exitedAt: now, decidedByUserId },
      });

      const others = { jobId: application.jobId, status: "IN_PROGRESS" as const, id: { not: applicationId } };
      await tx.applicationStageHistory.updateMany({
        where: { exitedAt: null, application: others },
        data: { exitedAt: now, decidedByUserId },
      });
      await tx.application.updateMany({ where: others, data: { status: "REJECTED" } });
    });
    return { currentStage: { type: application.currentStage.type, order: application.currentStage.order }, status: "APPROVED" };
  }

  await prisma.$transaction([
    prisma.applicationStageHistory.updateMany({
      where: { applicationId, stageId: application.currentStageId, exitedAt: null },
      data: { exitedAt: now, decidedByUserId },
    }),
    prisma.application.update({ where: { id: applicationId }, data: { currentStageId: nextStage.id } }),
    prisma.applicationStageHistory.create({ data: { applicationId, stageId: nextStage.id, enteredAt: now } }),
  ]);

  return { currentStage: { type: nextStage.type, order: nextStage.order }, status: "IN_PROGRESS" };
}
