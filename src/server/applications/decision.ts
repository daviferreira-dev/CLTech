// RF08 / FR-049 / FR-050 — avançar/reprovar. Nunca aceita nem grava score (Princípio II).
import { prisma } from "@/lib/prisma";
import { INTERVIEW_STAGES, positionsOf } from "@/lib/processStages";
import { stageAdvancedMoment } from "@/lib/emailMoments";
import type { CodeTestStageConfig } from "@/lib/codeTest";
import { Errors } from "@/lib/errors";
import type { MeetingInput } from "@/lib/validation/applications";
import { keepAlive } from "@/server/background";
import { notifyApplicationClosed, notifyStageAdvanced } from "@/server/email/notify";
import { closeStragglers } from "@/server/jobs/closeStragglers";
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
  if (!application) throw Errors.notFound("Candidatura", true);
  if (application.status !== "IN_PROGRESS") {
    throw Errors.conflict("APPLICATION_CLOSED", "Esta candidatura já foi decidida.");
  }

  const now = new Date();
  const job = application.job;

  // RN005: avisa o candidato que passou de etapa, foi aprovado ou reprovado. Sem await — o
  // e-mail não segura a resposta ao recrutador, e falha de envio só vai pro log (notify.ts).
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const to = application.candidate.user;

  if (decision === "REJECT") {
    await prisma.$transaction([
      prisma.application.update({ where: { id: applicationId }, data: { status: "REJECTED" } }),
      prisma.applicationStageHistory.updateMany({
        where: { applicationId, stageId: application.currentStageId, exitedAt: null },
        data: { exitedAt: now, decidedByUserId },
      }),
    ]);
    keepAlive(
      notifyApplicationClosed({
        to,
        jobTitle: job.title,
        company: job.company,
        stageType: application.currentStage.type,
        moment: "REJECTED",
        override: {
          emailMode: job.rejectedEmailMode,
          emailTemplateId: job.rejectedEmailTemplateId,
          emailSubject: job.rejectedEmailSubject,
          emailBody: job.rejectedEmailBody,
        },
        appUrl,
      }),
    );
    return { currentStage: { type: application.currentStage.type, order: application.currentStage.order }, status: "REJECTED" };
  }

  const nextStage = job.stages.find((stage) => stage.order === application.currentStage.order + 1);

  if (!nextStage) {
    // Última etapa (ex.: proposta final) — avançar aprova de fato. A vaga fecha quando todas as
    // posições forem preenchidas (config.positions, padrão 1); só então quem ainda estava em
    // andamento é reprovado. Tudo na mesma transação.
    const positions = positionsOf(application.currentStage.config);
    const outcome = await prisma.$transaction(async (tx) => {
      // Trava a linha da vaga: aprovações simultâneas são contadas uma de cada vez.
      await tx.$queryRaw`SELECT id FROM "Job" WHERE id = ${application.jobId} FOR UPDATE`;
      const lockedJob = await tx.job.findUniqueOrThrow({ where: { id: application.jobId }, select: { status: true } });
      if (lockedJob.status === "CLOSED") {
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
      const affected = await closeStragglers(tx, application.jobId, now, { excludeApplicationId: applicationId, decidedByUserId });
      return { filled: true, affected };
    });
    keepAlive(
      notifyStageAdvanced({
        to,
        jobTitle: job.title,
        company: job.company,
        stages: job.stages,
        newStageOrder: null,
        moment: "APPROVED",
        override: {
          emailMode: job.approvedEmailMode,
          emailTemplateId: job.approvedEmailTemplateId,
          emailSubject: job.approvedEmailSubject,
          emailBody: job.approvedEmailBody,
        },
        appUrl,
      }),
    );
    for (const other of outcome.affected) {
      keepAlive(
        notifyApplicationClosed({
          to: other.candidate.user,
          jobTitle: job.title,
          company: job.company,
          stageType: other.currentStage.type,
          moment: "JOB_CLOSED",
          appUrl,
        }),
      );
    }
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
  keepAlive(
    notifyStageAdvanced({
      to,
      jobTitle: job.title,
      company: job.company,
      stages: job.stages,
      newStageOrder: nextStage.order,
      meeting: scheduled ? { at: new Date(scheduled.scheduledAt), url: scheduled.url } : undefined,
      codeTestMinutes: (nextStage.config as CodeTestStageConfig)?.timeLimitMinutes,
      moment: stageAdvancedMoment(nextStage.type as Parameters<typeof stageAdvancedMoment>[0]),
      override: {
        emailMode: nextStage.emailMode,
        emailTemplateId: nextStage.emailTemplateId,
        emailSubject: nextStage.emailSubject,
        emailBody: nextStage.emailBody,
      },
      appUrl,
    }),
  );
  // Etapas automáticas (currículo/GitHub) analisam ao entrar, com os dados mais recentes.
  keepAlive(runStageAnalysis(applicationId, nextStage.type));

  return { currentStage: { type: nextStage.type, order: nextStage.order }, status: "IN_PROGRESS" };
}
