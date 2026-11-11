// Spec 010 FR-1001 — meta da 3aq: tempo do anúncio da vaga até a proposta final (D1). Sai do
// histórico de etapas que já existe (D6, sem migration); a regra fica em src/lib/velocity.ts.
import { prisma } from "@/lib/prisma";
import { daysToOffer, summarizeTimeToOffer, type TimeToOffer } from "@/lib/velocity";

export async function getTimeToOffer(filters: { jobId?: string } = {}): Promise<TimeToOffer> {
  const jobs = await prisma.job.findMany({
    where: { publishedAt: { not: null }, ...(filters.jobId ? { id: filters.jobId } : {}) },
    select: { id: true, publishedAt: true, stages: { where: { type: "FINAL_OFFER" }, select: { id: true } } },
  });
  if (jobs.length === 0) return summarizeTimeToOffer([], process.env);

  // Uma leitura: entradas na Proposta Final e as saídas das candidaturas aprovadas (a última
  // saída de uma aprovada é o momento da aprovação).
  const rows = await prisma.applicationStageHistory.findMany({
    where: {
      application: { jobId: { in: jobs.map((j) => j.id) } },
      OR: [{ stage: { type: "FINAL_OFFER" } }, { exitedAt: { not: null }, application: { status: "APPROVED" } }],
    },
    select: { applicationId: true, enteredAt: true, exitedAt: true, stage: { select: { type: true } }, application: { select: { jobId: true, status: true } } },
  });

  const finalOfferByJob = new Map<string, Date[]>();
  const approvalByApplication = new Map<string, { jobId: string; at: Date }>();
  for (const row of rows) {
    if (row.stage.type === "FINAL_OFFER") {
      const list = finalOfferByJob.get(row.application.jobId) ?? [];
      list.push(row.enteredAt);
      finalOfferByJob.set(row.application.jobId, list);
    }
    if (row.application.status === "APPROVED" && row.exitedAt) {
      const current = approvalByApplication.get(row.applicationId);
      if (!current || row.exitedAt > current.at) approvalByApplication.set(row.applicationId, { jobId: row.application.jobId, at: row.exitedAt });
    }
  }
  const approvalsByJob = new Map<string, Date[]>();
  for (const { jobId, at } of approvalByApplication.values()) {
    const list = approvalsByJob.get(jobId) ?? [];
    list.push(at);
    approvalsByJob.set(jobId, list);
  }

  const daysPerJob = jobs
    .map((job) =>
      daysToOffer({
        publishedAt: job.publishedAt,
        hasFinalOfferStage: job.stages.length > 0,
        finalOfferEnteredAt: finalOfferByJob.get(job.id) ?? [],
        approvedAt: approvalsByJob.get(job.id) ?? [],
      }),
    )
    .filter((days): days is number => days !== null);

  return summarizeTimeToOffer(daysPerJob, process.env);
}
