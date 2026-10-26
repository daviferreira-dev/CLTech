// RF08 / FR-049 / FR-050 — avançar/reprovar. Nunca aceita nem grava score (Princípio II).
import { prisma } from "@/lib/prisma";
import { INTERVIEW_STAGES, positionsOf } from "@/lib/processStages";
import { Errors } from "@/lib/errors";
import type { MeetingInput } from "@/lib/validation/applications";
import { keepAlive } from "@/server/background";
import { sendMail } from "@/server/email/mailer";
import { stageAdvancedEmail } from "@/server/email/templates/stage-advanced";
import { rejectedEmail } from "@/server/email/templates/rejected";
import { runStageAnalysis } from "@/server/applications/stage-analysis";

export interface DecisionResult {
  currentStage: { type: string; order: number };
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
}

export async function recordDecision(
  applicationId: string,
  decidedByUserId: string,
  decision: "ADVANCE" | "REJECT",
  meeting?: MeetingInput,
): Promise<DecisionResult> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      currentStage: true,
      candidate: { include: { user: { select: { name: true, email: true } } } },
      job: { include: { stages: { orderBy: { order: "asc" } } } },
    },
  });
  if (!application) throw Errors.notFound("Candidatura");
  if (application.status !== "IN_PROGRESS") {
    throw Errors.conflict("APPLICATION_CLOSED", "Esta candidatura já foi decidida.");
  }

  const now = new Date();

  // RN005: avisa o candidato que passou de etapa, foi aprovado ou reprovado. Sem await — o
  // e-mail não segura a resposta ao recrutador, e falha de SMTP só vai pro log.
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const notifyAdvanced = (newStageOrder: number | null, scheduled?: MeetingInput) =>
    keepAlive(
      sendMail(
        stageAdvancedEmail({
          to: application.candidate.user.email,
          candidateName: application.candidate.user.name,
          jobTitle: application.job.title,
          stages: application.job.stages,
          newStageOrder,
          meeting: scheduled ? { at: new Date(scheduled.scheduledAt), url: scheduled.url } : undefined,
          appUrl,
        }),
      ),
    );
  const notifyRejected = (
    candidate: { name: string; email: string },
    stageType: string,
    reason: "REJECTED" | "JOB_FILLED",
  ) =>
    keepAlive(
      sendMail(
        rejectedEmail({
          to: candidate.email,
          candidateName: candidate.name,
          jobTitle: application.job.title,
          stageType,
          reason,
          appUrl,
        }),
      ),
    );

  if (decision === "REJECT") {
    await prisma.$transaction([
      prisma.application.update({ where: { id: applicationId }, data: { status: "REJECTED" } }),
      prisma.applicationStageHistory.updateMany({
        where: { applicationId, stageId: application.currentStageId, exitedAt: null },
        data: { exitedAt: now, decidedByUserId },
      }),
    ]);
    notifyRejected(application.candidate.user, application.currentStage.type, "REJECTED");
    return { currentStage: { type: application.currentStage.type, order: application.currentStage.order }, status: "REJECTED" };
  }

  const nextStage = application.job.stages.find((stage) => stage.order === application.currentStage.order + 1);

  if (!nextStage) {
    // Última etapa (ex.: proposta final) — avançar aprova de fato. A vaga fecha quando todas as
    // posições forem preenchidas (config.positions, padrão 1); só então quem ainda estava em
    // andamento é reprovado. Tudo na mesma transação.
    const positions = positionsOf(application.currentStage.config);
    const outcome = await prisma.$transaction(async (tx) => {
      // Trava a linha da vaga: aprovações simultâneas são contadas uma de cada vez.
      await tx.$queryRaw`SELECT id FROM "Job" WHERE id = ${application.jobId} FOR UPDATE`;
      const job = await tx.job.findUniqueOrThrow({ where: { id: application.jobId }, select: { status: true } });
      if (job.status === "CLOSED") {
        throw Errors.conflict("JOB_CLOSED", "Esta vaga já foi encerrada com todas as posições preenchidas.");
      }

      await tx.application.update({ where: { id: applicationId }, data: { status: "APPROVED" } });
      await tx.applicationStageHistory.updateMany({
        where: { applicationId, stageId: application.currentStageId, exitedAt: null },
        data: { exitedAt: now, decidedByUserId },
      });

      const approved = await tx.application.count({ where: { jobId: application.jobId, status: "APPROVED" } });
      if (approved < positions) return { filled: false, affected: [] };

      await tx.job.update({ where: { id: application.jobId }, data: { status: "CLOSED" } });
      const others = { jobId: application.jobId, status: "IN_PROGRESS" as const, id: { not: applicationId } };
      // Lidos antes de reprovar: quem estava em andamento recebe o aviso de vaga preenchida.
      const affected = await tx.application.findMany({
        where: others,
        select: {
          currentStage: { select: { type: true } },
          candidate: { select: { user: { select: { name: true, email: true } } } },
        },
      });
      await tx.applicationStageHistory.updateMany({
        where: { exitedAt: null, application: others },
        data: { exitedAt: now, decidedByUserId },
      });
      await tx.application.updateMany({ where: others, data: { status: "REJECTED" } });
      return { filled: true, affected };
    });
    notifyAdvanced(null);
    for (const other of outcome.affected) notifyRejected(other.candidate.user, other.currentStage.type, "JOB_FILLED");
    return { currentStage: { type: application.currentStage.type, order: application.currentStage.order }, status: "APPROVED" };
  }

  // Entrevista: sem data e link o candidato não tem como comparecer.
  const needsMeeting = INTERVIEW_STAGES.includes(nextStage.type);
  if (needsMeeting && !meeting) {
    throw Errors.validation("Informe a data e o link da reunião para avançar para a entrevista.");
  }
  if (needsMeeting && meeting && new Date(meeting.scheduledAt).getTime() <= now.getTime()) {
    throw Errors.validation("A data da reunião deve ser no futuro.");
  }
  const scheduled = needsMeeting ? meeting : undefined;

  await prisma.$transaction([
    prisma.applicationStageHistory.updateMany({
      where: { applicationId, stageId: application.currentStageId, exitedAt: null },
      data: { exitedAt: now, decidedByUserId },
    }),
    prisma.application.update({ where: { id: applicationId }, data: { currentStageId: nextStage.id } }),
    prisma.applicationStageHistory.create({
      data: {
        applicationId,
        stageId: nextStage.id,
        enteredAt: now,
        meetingAt: scheduled ? new Date(scheduled.scheduledAt) : null,
        meetingUrl: scheduled?.url ?? null,
      },
    }),
  ]);
  notifyAdvanced(nextStage.order, scheduled);
  // Etapas automáticas (currículo/GitHub) analisam ao entrar, com os dados mais recentes.
  keepAlive(runStageAnalysis(applicationId, nextStage.type));

  return { currentStage: { type: nextStage.type, order: nextStage.order }, status: "IN_PROGRESS" };
}
