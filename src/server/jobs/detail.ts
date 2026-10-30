// RF03 / FR-020: detalhe de vaga. 404 exceto para quem já tem candidatura nela
// (edge case "vaga despublicada com candidatos inscritos").
// FR-033/FR-035/FR-036: compatibilidade com justificativa, só para o próprio candidato.
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import type { MatchScoreView } from "@/server/jobs/list";

export interface JobDetail {
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
  stages: Array<{ type: string; order: number }>;
  matchScore?: MatchScoreView & { matched?: string[]; missing?: string[] };
  /** Só para o próprio candidato: já existe candidatura dele nesta vaga (única por par). */
  hasApplied?: boolean;
}

export async function getJobDetail(jobId: string, requesterUserId: string | null): Promise<JobDetail> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { stages: { orderBy: { order: "asc" }, select: { type: true, order: true } } },
  });

  if (!job) throw Errors.notFound("Vaga", true);

  const hasOwnApplication = requesterUserId
    ? (await prisma.application.findFirst({
        where: { jobId, candidate: { userId: requesterUserId } },
        select: { id: true },
      })) !== null
    : false;

  if (job.status !== "PUBLISHED" && !hasOwnApplication) throw Errors.notFound("Vaga", true);

  const matchScore = requesterUserId ? await getMatchScoreForRequester(job.id, requesterUserId) : undefined;

  return {
    id: job.id,
    title: job.title,
    description: job.description,
    company: job.company,
    location: job.location,
    workMode: job.workMode,
    seniority: job.seniority,
    technologies: job.technologies,
    minimumRequirements: job.minimumRequirements,
    status: job.status,
    stages: job.stages,
    ...(matchScore ? { matchScore } : {}),
    ...(hasOwnApplication ? { hasApplied: true } : {}),
  };
}

async function getMatchScoreForRequester(
  jobId: string,
  requesterUserId: string,
): Promise<JobDetail["matchScore"] | undefined> {
  const candidate = await prisma.candidate.findUnique({ where: { userId: requesterUserId }, select: { id: true } });
  if (!candidate) return undefined; // recrutador/admin — FR-035 não exibe match pra ninguém além do próprio candidato

  const hasCurrentResume = await prisma.resume.findFirst({
    where: { candidateId: candidate.id, isCurrent: true },
    select: { id: true },
  });
  if (!hasCurrentResume) return { status: "NEEDS_RESUME" };

  const match = await prisma.jobMatch.findUnique({
    where: { candidateId_jobId: { candidateId: candidate.id, jobId } },
    select: { score: true, justification: true },
  });
  if (!match) return undefined;

  const justification = match.justification as { matched?: string[]; missing?: string[] } | null;
  return {
    status: "CALCULATED",
    value: match.score,
    matched: justification?.matched ?? [],
    missing: justification?.missing ?? [],
  };
}
