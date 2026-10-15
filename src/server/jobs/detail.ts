// RF03 / FR-020: detalhe de vaga. 404 exceto para quem já tem candidatura nela
// (edge case "vaga despublicada com candidatos inscritos").
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

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
}

export async function getJobDetail(jobId: string, requesterUserId: string | null): Promise<JobDetail> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { stages: { orderBy: { order: "asc" }, select: { type: true, order: true } } },
  });

  if (!job) throw Errors.notFound("Vaga");

  if (job.status !== "PUBLISHED") {
    const hasOwnApplication =
      requesterUserId &&
      (await prisma.application.findFirst({
        where: { jobId, candidate: { userId: requesterUserId } },
        select: { id: true },
      }));

    if (!hasOwnApplication) throw Errors.notFound("Vaga");
  }

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
  };
}
