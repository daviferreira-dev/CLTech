// RF09 / FR-051..053 / RN007 — busca candidatos já inscritos em qualquer vaga,
// agrupados por candidato único (por e-mail). Desejável (P2) — não é caminho crítico.
import { prisma } from "@/lib/prisma";

export interface CandidateSearchApplication {
  jobId: string;
  jobTitle: string;
  score: number | null;
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
}

export interface CandidateSearchItem {
  candidateId: string;
  name: string;
  email: string;
  applications: CandidateSearchApplication[];
}

export async function searchCandidates(query: string): Promise<CandidateSearchItem[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const candidates = await prisma.candidate.findMany({
    where: { applications: { some: {} } },
    include: {
      user: { select: { name: true, email: true } },
      applications: {
        include: { job: { select: { id: true, title: true, technologies: true } } },
        orderBy: { appliedAt: "desc" },
      },
    },
  });

  const matches = candidates.filter((candidate) => {
    if (candidate.user.name.toLowerCase().includes(needle)) return true;
    if (candidate.user.email.toLowerCase().includes(needle)) return true;
    return candidate.applications.some((application) =>
      application.job.technologies.some((tech) => tech.toLowerCase().includes(needle)),
    );
  });

  return matches.map((candidate) => ({
    candidateId: candidate.id,
    name: candidate.user.name,
    email: candidate.user.email,
    applications: candidate.applications.map((application) => ({
      jobId: application.job.id,
      jobTitle: application.job.title,
      score: application.matchScore,
      status: application.status,
    })),
  }));
}
