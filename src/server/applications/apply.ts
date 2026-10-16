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
import { getCandidateSignals } from "@/server/matching/recompute";
import { computeScore } from "@/server/matching/score";

export interface ApplyResult {
  applicationId: string;
  currentStage: { type: string; order: number };
  appliedAt: Date;
  matchScoreStatus: "CALCULATED" | "NOT_CALCULATED";
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
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!job) throw Errors.notFound("Vaga");
  if (job.status !== "PUBLISHED") {
    throw Errors.businessRule("JOB_NOT_OPEN", "Esta vaga não está mais aceitando candidaturas.");
  }
  const firstStage = job.stages[0];
  if (!firstStage) {
    throw Errors.businessRule("JOB_NOT_OPEN", "Esta vaga ainda não tem um processo seletivo configurado.");
  }

  // RN001/Princípio III: nenhuma candidatura existe sem avaliação automática já registrada
  // junto — calculada antes do INSERT, nunca depois (R14). Mesmo sem nenhum sinal (ex.:
  // currículo ilegível e sem GitHub), a Evaluation existe com score 0 — Princípio III exige
  // a avaliação em si, não que ela tenha encontrado algo.
  const signals = await getCandidateSignals(candidate.id);
  const resumeMatch = computeScore(job.technologies, signals) ?? { score: 0, matched: [], missing: job.technologies };
  const hasGithubStage = job.stages.some((stage) => stage.type === "GITHUB_ANALYSIS");
  const githubOnly =
    hasGithubStage && signals.githubLanguages
      ? computeScore(job.technologies, { resumeText: null, githubLanguages: signals.githubLanguages })
      : null;

  try {
    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          resumeId: currentResume.id,
          currentStageId: firstStage.id,
          matchScore: resumeMatch.score,
          matchScoreStatus: "CALCULATED",
        },
      });

      await tx.applicationStageHistory.create({
        data: { applicationId: created.id, stageId: firstStage.id },
      });

      await tx.evaluation.create({
        data: {
          applicationId: created.id,
          type: "RESUME_MATCH",
          score: resumeMatch.score,
          justification: { matched: resumeMatch.matched, missing: resumeMatch.missing },
        },
      });
      if (githubOnly) {
        await tx.evaluation.create({
          data: {
            applicationId: created.id,
            type: "GITHUB_ANALYSIS",
            score: githubOnly.score,
            justification: { matched: githubOnly.matched, missing: githubOnly.missing },
          },
        });
      }

      return created;
    });

    return {
      applicationId: application.id,
      currentStage: { type: firstStage.type, order: firstStage.order },
      appliedAt: application.appliedAt,
      matchScoreStatus: "CALCULATED",
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
