// RF08 / FR-047 / FR-048 — relatório completo do candidato dentro de uma candidatura.
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { getCodeTestReport, type CodeTestReport } from "@/server/code-test/report";
import type { ProfileDetails } from "@/lib/profile-details";
import { profileDetailsInclude, toProfileDetails } from "@/server/candidates/profile-details";

export interface ApplicationDetail {
  id: string;
  candidate: { name: string; email: string };
  /** Perfil profissional do candidato (spec 007, FR-710). */
  professionalProfile: ProfileDetails;
  job: { id: string; title: string };
  currentStage: { type: string; order: number };
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  evaluations: Array<{ type: string; score: number; justification: unknown }>;
  externalAccounts: Array<{ provider: string; status: string }>;
  resume: { id: string; originalFilename: string } | null;
  codeTest: CodeTestReport;
}

export async function getApplicationDetail(applicationId: string): Promise<ApplicationDetail> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      candidate: { include: { user: true, externalAccounts: true, ...profileDetailsInclude } },
      job: { select: { id: true, title: true } },
      currentStage: { select: { type: true, order: true } },
      resume: { select: { id: true, originalFilename: true } },
      evaluations: { orderBy: { createdAt: "desc" }, select: { type: true, score: true, justification: true } },
    },
  });
  if (!application) throw Errors.notFound("Candidatura");

  // Mantém só a avaliação mais recente por tipo (reprocessamento insere nova versão, D7).
  const latestByType = new Map<string, { type: string; score: number; justification: unknown }>();
  for (const evaluation of application.evaluations) {
    if (!latestByType.has(evaluation.type)) latestByType.set(evaluation.type, evaluation);
  }

  return {
    id: application.id,
    candidate: { name: application.candidate.user.name, email: application.candidate.user.email },
    professionalProfile: toProfileDetails(application.candidate),
    job: application.job,
    currentStage: application.currentStage,
    status: application.status,
    evaluations: [...latestByType.values()],
    externalAccounts: application.candidate.externalAccounts.map((account) => ({
      provider: account.provider,
      status: account.status,
    })),
    resume: application.resume,
    codeTest: await getCodeTestReport(application.id),
  };
}
