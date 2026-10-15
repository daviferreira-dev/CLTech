// RF03 / FR-018 / FR-019: listagem pública e filtrada, só vagas PUBLISHED.
import { prisma } from "@/lib/prisma";
import type { JobListQuery } from "@/lib/validation/jobs";

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  seniority: "INTERN" | "JUNIOR" | "MID" | "SENIOR";
  technologies: string[];
}

export interface JobListResult {
  items: JobListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listPublishedJobs(query: JobListQuery): Promise<JobListResult> {
  const where = {
    status: "PUBLISHED" as const,
    ...(query.workMode ? { workMode: query.workMode } : {}),
    ...(query.seniority ? { seniority: query.seniority } : {}),
    ...(query.technology ? { technologies: { has: query.technology } } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" as const } },
            { description: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        workMode: true,
        seniority: true,
        technologies: true,
      },
    }),
    prisma.job.count({ where }),
  ]);

  return { items, page: query.page, pageSize: query.pageSize, total };
}
