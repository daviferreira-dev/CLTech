// RF03 / FR-018 / FR-019: listagem pública e filtrada, só vagas PUBLISHED.
// FR-033/FR-035/FR-036: percentual de compatibilidade, só para o próprio candidato
// autenticado — nunca calculado aqui, só lido de JobMatch (D3 da Sprint 1).
import { prisma } from "@/lib/prisma";
import type { JobListQuery } from "@/lib/validation/jobs";

export type MatchScoreView = { status: "CALCULATED"; value: number } | { status: "NEEDS_RESUME" };

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  seniority: "INTERN" | "JUNIOR" | "MID" | "SENIOR";
  technologies: string[];
  matchScore?: MatchScoreView;
}

export interface JobListResult {
  items: JobListItem[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Tecnologias das vagas publicadas que contêm o termo digitado, sem diferenciar maiúsculas
 * ("rea" → "React", "node" → "Node.js"). Permite a busca enquanto se digita: o filtro antigo
 * exigia o nome exato. Curingas do LIKE no termo são escapados.
 */
async function technologiesMatching(term: string): Promise<string[]> {
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await prisma.$queryRaw<Array<{ tech: string }>>`
    SELECT DISTINCT t AS tech
    FROM "Job" j, unnest(j."technologies") AS t
    WHERE j."status" = 'PUBLISHED' AND t ILIKE ${pattern}
  `;
  return rows.map((row: { tech: string }) => row.tech);
}

export async function listPublishedJobs(query: JobListQuery, requesterUserId?: string | null): Promise<JobListResult> {
  const technologies = query.technology ? await technologiesMatching(query.technology) : null;
  if (technologies && technologies.length === 0) {
    return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
  }
  const where = {
    status: "PUBLISHED" as const,
    ...(query.workMode ? { workMode: query.workMode } : {}),
    ...(query.seniority ? { seniority: query.seniority } : {}),
    ...(technologies ? { technologies: { hasSome: technologies } } : {}),
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

  const candidate = requesterUserId
    ? await prisma.candidate.findUnique({ where: { userId: requesterUserId }, select: { id: true } })
    : null;
  if (!candidate) return { items, page: query.page, pageSize: query.pageSize, total };
  const candidateId = candidate.id;

  const [hasCurrentResume, matches] = await Promise.all([
    prisma.resume.findFirst({ where: { candidateId, isCurrent: true }, select: { id: true } }),
    prisma.jobMatch.findMany({
      where: { candidateId, jobId: { in: items.map((item) => item.id) } },
      select: { jobId: true, score: true },
    }),
  ]);

  const scoreByJobId = new Map(matches.map((match) => [match.jobId, match.score]));
  const itemsWithMatch: JobListItem[] = items.map((item) => {
    if (!hasCurrentResume) return { ...item, matchScore: { status: "NEEDS_RESUME" } };
    const score = scoreByJobId.get(item.id);
    return score === undefined ? item : { ...item, matchScore: { status: "CALCULATED", value: score } };
  });

  return { items: itemsWithMatch, page: query.page, pageSize: query.pageSize, total };
}
