// Suporte de navegação pra RF08 — lista candidaturas de uma vaga pra chegar no relatório.
import { prisma } from "@/lib/prisma";

export interface JobApplicationListItem {
  id: string;
  candidateName: string;
  currentStageType: string;
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  matchScore: number | null;
}

export async function listApplicationsForJob(jobId: string): Promise<JobApplicationListItem[]> {
  const applications = await prisma.application.findMany({
    where: { jobId },
    // Maior match primeiro; quem ainda não foi triado vai pro fim. Empate: candidatura mais recente.
    orderBy: [{ matchScore: { sort: "desc", nulls: "last" } }, { appliedAt: "desc" }],
    include: { candidate: { include: { user: true } }, currentStage: { select: { type: true } } },
  });

  return applications.map((application) => ({
    id: application.id,
    candidateName: application.candidate.user.name,
    currentStageType: application.currentStage.type,
    status: application.status,
    matchScore: application.matchScore,
  }));
}
