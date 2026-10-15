// FR-025: candidato consulta todas as suas candidaturas.
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

export interface MyApplicationItem {
  applicationId: string;
  job: { id: string; title: string; company: string };
  appliedAt: Date;
  currentStage: { type: string; order: number };
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  matchScoreStatus: "NOT_CALCULATED" | "PENDING" | "CALCULATED" | "FAILED";
}

export async function listMyApplications(userId: string): Promise<MyApplicationItem[]> {
  const candidate = await prisma.candidate.findUnique({ where: { userId }, select: { id: true } });
  if (!candidate) throw Errors.notFound("Perfil");

  const applications = await prisma.application.findMany({
    where: { candidateId: candidate.id },
    orderBy: { appliedAt: "desc" },
    include: {
      job: { select: { id: true, title: true, company: true } },
      currentStage: { select: { type: true, order: true } },
    },
  });

  return applications.map((app) => ({
    applicationId: app.id,
    job: app.job,
    appliedAt: app.appliedAt,
    currentStage: app.currentStage,
    status: app.status,
    matchScoreStatus: app.matchScoreStatus,
  }));
}
