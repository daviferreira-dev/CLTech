// Spec 009 (FR-908): avançar ou reprovar várias candidaturas de uma vaga de uma vez. Reaproveita
// recordDecision item por item (mesmas regras, e-mails e histórico): nenhum atalho no banco.
// ponytail: sequencial, um por vez (até BULK_DECISION_MAX = 20, pelo tempo de função da Vercel
// Hobby); para lotes maiores, uma fila em segundo plano.
import { prisma } from "@/lib/prisma";
import { Errors, ApiError } from "@/lib/errors";
import { INTERVIEW_STAGES } from "@/lib/processStages";
import type { RejectionInput } from "@/lib/validation/applications";
import { recordDecision } from "@/server/applications/decision";

export interface BulkDecisionResult {
  done: Array<{ id: string; name: string }>;
  /** Já finalizadas (aprovadas, reprovadas, retiradas) ou fechadas no meio do lote. */
  skipped: Array<{ id: string; name: string }>;
  failed: Array<{ id: string; name: string; message: string }>;
}

export async function recordBulkDecision(
  jobId: string,
  decidedByUserId: string,
  applicationIds: string[],
  decision: "ADVANCE" | "REJECT",
  rejection?: RejectionInput,
): Promise<BulkDecisionResult> {
  const ids = [...new Set(applicationIds)];
  const [job, applications] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId }, select: { stages: { select: { type: true, order: true } } } }),
    prisma.application.findMany({
      where: { id: { in: ids }, jobId },
      select: { id: true, status: true, currentStage: { select: { order: true } }, candidate: { select: { user: { select: { name: true } } } } },
    }),
  ]);
  if (!job) throw Errors.notFound("Vaga", true);
  const byId = new Map(applications.map((a) => [a.id, a]));

  // A reunião é obrigatória e individual: avançar para entrevista é um por vez.
  if (decision === "ADVANCE") {
    const goesToInterview = applications.some((a) => {
      if (a.status !== "IN_PROGRESS") return false;
      const next = job.stages.find((s) => s.order === a.currentStage.order + 1);
      return next && INTERVIEW_STAGES.includes(next.type);
    });
    if (goesToInterview) {
      throw Errors.validation("Para entrevistas, avance um candidato por vez para marcar a reunião.");
    }
  }

  const result: BulkDecisionResult = { done: [], skipped: [], failed: [] };
  for (const id of ids) {
    const application = byId.get(id);
    if (!application) {
      result.failed.push({ id, name: "—", message: "Candidatura não encontrada nesta vaga." });
      continue;
    }
    const name = application.candidate.user.name;
    if (application.status !== "IN_PROGRESS") {
      result.skipped.push({ id, name });
      continue;
    }
    try {
      await recordDecision(id, decidedByUserId, decision, undefined, rejection);
      result.done.push({ id, name });
    } catch (err) {
      // Aprovar a última posição fecha a vaga e encerra os demais no meio do lote.
      if (err instanceof ApiError && (err.code === "APPLICATION_CLOSED" || err.code === "JOB_CLOSED")) {
        result.skipped.push({ id, name });
      } else {
        result.failed.push({ id, name, message: err instanceof ApiError ? err.message : "Erro inesperado." });
      }
    }
  }
  return result;
}
