// RF04 / FR-038..042 / RN002 — criação, edição e publicação de vaga pelo recrutador.
// Vaga publicada trava tecnologias/requisitos/etapas (FR-041, D7 da Sprint 1).
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors, ApiError } from "@/lib/errors";
import { recomputeJobMatchesForJob } from "@/server/matching/recompute";
import type { CreateJobInput, UpdateJobInput, SetStagesInput } from "@/lib/validation/jobs";

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
  stages: Array<{ id: string; type: string; order: number }>;
}

async function toView(jobId: string): Promise<RecruiterJobView> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { stages: { orderBy: { order: "asc" }, select: { id: true, type: true, order: true } } },
  });
  return job;
}

export async function createJob(userId: string, input: CreateJobInput): Promise<RecruiterJobView> {
  const job = await prisma.job.create({
    data: { ...input, status: "DRAFT", createdById: userId },
  });
  return toView(job.id);
}

export async function updateDraftJob(jobId: string, input: UpdateJobInput): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw Errors.notFound("Vaga");

  if (job.status === "PUBLISHED") {
    const touchesLockedField = LOCKED_FIELDS.some((field) => input[field] !== undefined);
    if (touchesLockedField) {
      throw Errors.conflict("JOB_LOCKED", "Vagas publicadas têm tecnologias e requisitos travados.");
    }
  }

  await prisma.job.update({ where: { id: jobId }, data: input });
  return toView(jobId);
}

/** Substitui o conjunto inteiro de etapas, já ordenado (FR-039/042, R16). */
export async function setStages(jobId: string, input: SetStagesInput): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw Errors.notFound("Vaga");
  if (job.status === "PUBLISHED") {
    throw Errors.conflict("JOB_LOCKED", "Vagas publicadas têm o pipeline travado.");
  }

  await prisma.$transaction([
    prisma.processStage.deleteMany({ where: { jobId } }),
    prisma.processStage.createMany({
      data: input.stages.map((stage, index) => ({
        jobId,
        type: stage.type,
        order: index,
        config: (stage.config ?? {}) as Prisma.InputJsonValue,
      })),
    }),
  ]);

  return toView(jobId);
}

/** Transição DRAFT -> PUBLISHED (FR-040, RN002). */
export async function publishJob(jobId: string): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true, technologies: true, minimumRequirements: true, _count: { select: { stages: true } } },
  });
  if (!job) throw Errors.notFound("Vaga");
  if (job.status !== "DRAFT") {
    throw Errors.conflict("ALREADY_PUBLISHED", "Esta vaga já foi publicada.");
  }

  const missing: string[] = [];
  if (job.technologies.length === 0) missing.push("technologies");
  if (!job.minimumRequirements.trim()) missing.push("minimumRequirements");
  if (job._count.stages === 0) missing.push("stages");

  if (missing.length > 0) {
    throw new ApiError(
      422,
      "INCOMPLETE_JOB",
      "Preencha tecnologias, requisitos mínimos e ao menos uma etapa antes de publicar.",
      { missing },
    );
  }

  await prisma.job.update({ where: { id: jobId }, data: { status: "PUBLISHED", publishedAt: new Date() } });

  // Gatilho 3 (FR-034): cria o JobMatch inicial para candidatos elegíveis. Fire-and-forget.
  recomputeJobMatchesForJob(jobId).catch(() => {});

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
  if (!job) throw Errors.notFound("Vaga");
  return toView(jobId);
}
