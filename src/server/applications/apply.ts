// RF03 / FR-021 / FR-022 / FR-024 — Entidade central da sprint.
//
// SC-003: duas candidaturas simultâneas do mesmo candidato à mesma vaga resultam
// em UMA só. Isso é garantido pelo índice único (candidateId, jobId) no banco
// (@@unique em Application), NÃO por um SELECT prévio — um SELECT-then-INSERT
// tem janela de corrida; a segunda inserção simultânea falhando com P2002 é o que
// torna o teste de concorrência (T048) determinístico.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

export interface ApplyResult {
  applicationId: string;
  currentStage: { type: string; order: number };
  appliedAt: Date;
  matchScoreStatus: "NOT_CALCULATED";
}

export async function applyToJob(userId: string, jobId: string): Promise<ApplyResult> {
  const candidate = await prisma.candidate.findUnique({
    where: { userId },
    include: { resumes: { where: { isCurrent: true }, take: 1 } },
  });
  if (!candidate) throw Errors.notFound("Perfil");

  // FR-024: currículo vigente é pré-condição, checado antes do INSERT (não é a
  // garantia de unicidade — só evita uma viagem ao banco desnecessária).
  const currentResume = candidate.resumes[0];
  if (!currentResume) {
    throw Errors.businessRule("RESUME_REQUIRED", "Anexe um currículo antes de se candidatar.");
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { stages: { orderBy: { order: "asc" }, take: 1 } },
  });
  if (!job) throw Errors.notFound("Vaga");
  if (job.status !== "PUBLISHED") {
    throw Errors.businessRule("JOB_NOT_OPEN", "Esta vaga não está mais aceitando candidaturas.");
  }
  const firstStage = job.stages[0];
  if (!firstStage) {
    throw Errors.businessRule("JOB_NOT_OPEN", "Esta vaga ainda não tem um processo seletivo configurado.");
  }

  try {
    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          resumeId: currentResume.id,
          currentStageId: firstStage.id,
        },
      });

      await tx.applicationStageHistory.create({
        data: { applicationId: created.id, stageId: firstStage.id },
      });

      return created;
    });

    return {
      applicationId: application.id,
      currentStage: { type: firstStage.type, order: firstStage.order },
      appliedAt: application.appliedAt,
      matchScoreStatus: "NOT_CALCULATED",
    };
  } catch (err) {
    // FR-022 / SC-003: violação do índice único (candidateId, jobId) é o ÚNICO
    // caminho para detectar candidatura duplicada — seguro sob concorrência.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.application.findUniqueOrThrow({
        where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
        include: { currentStage: { select: { type: true, order: true } } },
      });
      throw Errors.conflict(
        "ALREADY_APPLIED",
        `Você já se candidatou a esta vaga. Status atual: ${existing.status}.`,
      );
    }
    throw err;
  }
}
