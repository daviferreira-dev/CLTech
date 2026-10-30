// RF04 / FR-038..042 / RN002 — criação, edição e publicação de vaga pelo recrutador.
// Vaga publicada trava tecnologias/requisitos/etapas (FR-041, D7 da Sprint 1).
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors, ApiError } from "@/lib/errors";
import { recomputeJobMatchesForJob } from "@/server/matching/recompute";
import type { CreateJobInput, UpdateJobInput, SetStagesInput, StageEmailInput } from "@/lib/validation/jobs";
import { codeTestConfigSchema } from "@/lib/validation/challenges";
import { INTERVIEW_STAGES, MAX_POSITIONS, MIN_POSITIONS } from "@/lib/processStages";
import { isCodeTestConfigComplete, MAX_TEST_RUNS, type CodeTestStageConfig } from "@/lib/codeTest";
import { keepAlive } from "@/server/background";

const LOCKED_FIELDS = ["technologies", "minimumRequirements"] as const;

export interface RecruiterJobView {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  seniority: "INTERN" | "JUNIOR" | "MID" | "SENIOR";
  technologies: string[];
  minimumRequirements: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  publishedAt: Date | null;
  stages: Array<{ id: string; type: string; order: number; config: unknown; emailSubject: string | null; emailBody: string | null }>;
}

async function toView(jobId: string): Promise<RecruiterJobView> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { stages: { orderBy: { order: "asc" }, select: { id: true, type: true, order: true, config: true, emailSubject: true, emailBody: true } } },
  });
  return job;
}

/**
 * Spec 005 US1: valida e normaliza a configuração de cada etapa CODE_TEST — desafio que
 * existe, linguagens sempre subconjunto das do desafio, tempo dentro dos limites e o teto
 * de execuções do D5 fixado pelo servidor. Incompleta é aceita no rascunho; a publicação
 * é que exige completa.
 */
async function normalizeCodeTestConfig(config: Record<string, unknown> | undefined): Promise<CodeTestStageConfig> {
  const parsed = codeTestConfigSchema.safeParse(config ?? {});
  if (!parsed.success) throw Errors.validation(parsed.error.issues[0]?.message ?? "Configuração do teste de código inválida.");
  const { challengeId, languages, timeLimitMinutes } = parsed.data;
  if (!challengeId) return { ...parsed.data, maxTestRuns: MAX_TEST_RUNS };

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId }, select: { languages: true } });
  if (!challenge) throw Errors.validation("O desafio escolhido não existe mais no catálogo.");
  const chosen = languages && languages.length > 0 ? languages : challenge.languages;
  const outside = chosen.filter((language) => !challenge.languages.includes(language));
  if (outside.length > 0) {
    throw Errors.validation(`Linguagem fora das aceitas pelo desafio: ${outside.join(", ")}.`);
  }
  return { challengeId, languages: chosen, timeLimitMinutes, maxTestRuns: MAX_TEST_RUNS };
}

/** Proposta Final: grava só `positions`, inteiro dentro dos limites (padrão 1). */
function normalizeFinalOfferConfig(config: Record<string, unknown> | undefined): { positions: number } {
  const raw = config?.positions ?? MIN_POSITIONS;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < MIN_POSITIONS || raw > MAX_POSITIONS) {
    throw Errors.validation(`A quantidade de vagas da proposta final deve ser um inteiro entre ${MIN_POSITIONS} e ${MAX_POSITIONS}.`);
  }
  return { positions: raw };
}

export async function createJob(userId: string, input: CreateJobInput): Promise<RecruiterJobView> {
  const job = await prisma.job.create({
    data: { ...input, status: "DRAFT", createdById: userId },
  });
  return toView(job.id);
}

export async function updateDraftJob(jobId: string, input: UpdateJobInput): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw Errors.notFound("Vaga", true);

  if (job.status !== "DRAFT") {
    const touchesLockedField = LOCKED_FIELDS.some((field) => input[field] !== undefined);
    if (touchesLockedField) {
      throw Errors.conflict("JOB_LOCKED", "Vagas publicadas ou encerradas têm tecnologias e requisitos travados.");
    }
  }

  await prisma.job.update({ where: { id: jobId }, data: input });
  return toView(jobId);
}

/** Substitui o conjunto inteiro de etapas, já ordenado (FR-039/042, R16). */
export async function setStages(jobId: string, input: SetStagesInput): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw Errors.notFound("Vaga", true);
  if (job.status !== "DRAFT") {
    throw Errors.conflict("JOB_LOCKED", "Vagas publicadas ou encerradas têm o pipeline travado.");
  }

  if (input.stages.filter((stage) => stage.type === "FINAL_OFFER").length > 1) {
    throw Errors.validation("A vaga pode ter só uma Proposta Final; use a quantidade de vagas para contratar mais de uma pessoa.");
  }

  // Substituição completa (FR-039/042): sob Read Committed, dois PUT concorrentes
  // entrelaçam o delete de um com o insert do outro e colidem no índice único
  // (jobId, order). Serializable faz o banco recusar o entrelaçamento em vez de
  // gravar um pipeline pela metade.
  const configs = await Promise.all(
    input.stages.map((stage) => {
      if (stage.type === "CODE_TEST") return normalizeCodeTestConfig(stage.config);
      if (stage.type === "FINAL_OFFER") return normalizeFinalOfferConfig(stage.config);
      return stage.config ?? {};
    }),
  );

  await prisma.$transaction(
    async (tx) => {
      await tx.processStage.deleteMany({ where: { jobId } });
      await tx.processStage.createMany({
        data: input.stages.map((stage, index) => ({
          jobId,
          type: stage.type,
          order: index,
          config: configs[index] as Prisma.InputJsonValue,
          ...(INTERVIEW_STAGES.includes(stage.type) ? { emailSubject: stage.emailSubject || null, emailBody: stage.emailBody || null } : {}),
        })),
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return toView(jobId);
}

/**
 * Template do e-mail de entrevista. Diferente do pipeline, não trava com a vaga publicada:
 * é só texto e vale para os próximos avanços, sem mudar o processo que o candidato percorre.
 */
export async function setStageEmail(jobId: string, input: StageEmailInput): Promise<RecruiterJobView> {
  const stage = await prisma.processStage.findFirst({ where: { id: input.stageId, jobId }, select: { type: true } });
  if (!stage) throw Errors.notFound("Etapa", true);
  if (!INTERVIEW_STAGES.includes(stage.type)) throw Errors.validation("Só etapas de entrevista têm e-mail personalizado.");
  await prisma.processStage.update({
    where: { id: input.stageId },
    data: { emailSubject: input.emailSubject || null, emailBody: input.emailBody || null },
  });
  return toView(jobId);
}

/** Transição DRAFT -> PUBLISHED (FR-040, RN002). */
export async function publishJob(jobId: string): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      status: true,
      technologies: true,
      minimumRequirements: true,
      _count: { select: { stages: true } },
      stages: { where: { type: "CODE_TEST" }, select: { config: true } },
    },
  });
  if (!job) throw Errors.notFound("Vaga", true);
  if (job.status === "CLOSED") throw Errors.conflict("JOB_CLOSED", "Vaga encerrada.");
  if (job.status !== "DRAFT") {
    throw Errors.conflict("ALREADY_PUBLISHED", "Esta vaga já foi publicada.");
  }

  const missing: string[] = [];
  if (job.technologies.length === 0) missing.push("technologies");
  if (!job.minimumRequirements.trim()) missing.push("minimumRequirements");
  if (job._count.stages === 0) missing.push("stages");
  // Spec 005 US1.2: etapa de teste de código sem desafio travaria o candidato nela.
  if (job.stages.some((stage) => !isCodeTestConfigComplete(stage.config))) missing.push("codeTest");

  if (missing.length > 0) {
    throw new ApiError(
      422,
      "INCOMPLETE_JOB",
      "Preencha tecnologias, requisitos mínimos, ao menos uma etapa e a configuração do teste de código antes de publicar.",
      { missing },
    );
  }

  await prisma.job.update({ where: { id: jobId }, data: { status: "PUBLISHED", publishedAt: new Date() } });

  // Gatilho 3 (FR-034): cria o JobMatch inicial para candidatos elegíveis. Fire-and-forget.
  keepAlive(recomputeJobMatchesForJob(jobId).catch(() => {}));

  return toView(jobId);
}

/** Encerramento manual PUBLISHED -> CLOSED; o automático fica em decision.ts (Proposta Final). */
export async function closeJob(jobId: string): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw Errors.notFound("Vaga", true);
  if (job.status === "CLOSED") throw Errors.conflict("JOB_CLOSED", "Vaga encerrada.");
  if (job.status !== "PUBLISHED") throw Errors.conflict("NOT_PUBLISHED", "Só vagas publicadas podem ser encerradas.");
  await prisma.job.update({ where: { id: jobId }, data: { status: "CLOSED" } });
  return toView(jobId);
}

export interface RecruiterJobListItem {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  candidateCount: number;
  createdAt: Date;
}

export async function listRecruiterJobs(): Promise<RecruiterJobListItem[]> {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, createdAt: true, _count: { select: { applications: true } } },
  });
  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    status: job.status,
    candidateCount: job._count.applications,
    createdAt: job.createdAt,
  }));
}

export async function getRecruiterJobView(jobId: string): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw Errors.notFound("Vaga", true);
  return toView(jobId);
}
