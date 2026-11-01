// Compartilhado por decision.ts (última posição aprovada fecha a vaga) e builder.ts
// (recrutador encerra a vaga manualmente): quem ainda estava em andamento é reprovado e a
// etapa aberta é fechada, na mesma transação do fechamento da vaga. O e-mail de "vaga
// encerrada" é enviado por quem chama, FORA da transação (notify.ts já não lança, mas e-mail
// nunca deve rodar dentro de uma transação de banco).
import type { Prisma } from "@prisma/client";

export interface Straggler {
  currentStage: { type: string };
  candidate: { user: { name: string; email: string } };
}

export async function closeStragglers(
  tx: Prisma.TransactionClient,
  jobId: string,
  now: Date,
  opts: { excludeApplicationId?: string; decidedByUserId?: string | null } = {},
): Promise<Straggler[]> {
  const where = {
    jobId,
    status: "IN_PROGRESS" as const,
    ...(opts.excludeApplicationId ? { id: { not: opts.excludeApplicationId } } : {}),
  };
  const affected = await tx.application.findMany({
    where,
    select: {
      currentStage: { select: { type: true } },
      candidate: { select: { user: { select: { name: true, email: true } } } },
    },
  });
  if (affected.length === 0) return [];

  await tx.applicationStageHistory.updateMany({
    where: { exitedAt: null, application: where },
    data: { exitedAt: now, decidedByUserId: opts.decidedByUserId ?? null },
  });
  await tx.application.updateMany({ where, data: { status: "REJECTED" } });
  return affected;
}
