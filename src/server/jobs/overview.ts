// Visão macro das vagas (RH): todas as vagas de uma vez, por onde agir primeiro.
// Agregado no banco em poucas consultas fixas — nunca uma por vaga (sem N+1).
import { prisma } from "@/lib/prisma";
import { positionsOf } from "@/lib/processStages";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export interface JobOverviewFilters {
  status?: "DRAFT" | "PUBLISHED" | "CLOSED";
  recruiterId?: string;
  /** Período pelo marco da vaga: publishedAt, ou createdAt enquanto ainda é rascunho. */
  from?: Date;
  to?: Date;
  search?: string;
}

export interface JobOverviewStageCount {
  stageType: string;
  count: number;
}

export interface JobOverviewBottleneck {
  stageType: string;
  count: number;
  avgHoursWaiting: number;
}

export interface JobOverviewRow {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  recruiter: { id: string; name: string };
  createdAt: string;
  publishedAt: string | null;
  /** Dias desde a publicação (encerrada: até o encerramento). Nula: ainda é rascunho. */
  daysOpen: number | null;
  totalCandidates: number;
  byStage: JobOverviewStageCount[];
  approvedCount: number;
  rejectedCount: number;
  /** Aprovados / decididos (aprovados + reprovados). Nula: ninguém decidido ainda. */
  conversionRate: number | null;
  bottleneck: JobOverviewBottleneck | null;
  awaitingDecision: number;
  codeTestPending: number;
  codeTestSubmitted: number;
  lastActivityAt: string;
  daysSinceActivity: number;
  positionsFilled: number;
  positionsTotal: number | null;
}

export interface JobOverviewSummary {
  openJobs: number;
  activeCandidates: number;
  awaitingDecision: number;
  hiresInPeriod: number;
  avgDaysToHire: number | null;
}

export interface JobOverviewResult {
  summary: JobOverviewSummary;
  jobs: JobOverviewRow[];
  recruiters: Array<{ id: string; name: string }>;
}

function inPeriod(date: Date, from?: Date, to?: Date): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export async function getJobsOverview(filters: JobOverviewFilters = {}): Promise<JobOverviewResult> {
  const { status, recruiterId, from, to, search } = filters;

  const jobs = await prisma.job.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(recruiterId ? { createdById: recruiterId } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
      ...(from || to
        ? {
            OR: [
              { publishedAt: { gte: from, lte: to } },
              { AND: [{ publishedAt: null }, { createdAt: { gte: from, lte: to } }] },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      createdBy: { select: { id: true, name: true } },
      stages: { select: { id: true, type: true, order: true, config: true }, orderBy: { order: "asc" } },
    },
  });

  // Dropdown de recrutador responsável: todo mundo que já criou vaga, sem depender do filtro atual.
  const allCreators = await prisma.job.findMany({
    distinct: ["createdById"],
    select: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdById: "asc" },
  });
  const recruiters = allCreators.map((j) => j.createdBy).sort((a, b) => a.name.localeCompare(b.name));

  if (jobs.length === 0) {
    return { summary: { openJobs: 0, activeCandidates: 0, awaitingDecision: 0, hiresInPeriod: 0, avgDaysToHire: null }, jobs: [], recruiters };
  }
  const jobIds = jobs.map((j) => j.id);
  const now = new Date();

  // Uma consulta: contagem por (vaga, status) + última atividade (maior updatedAt) por vaga.
  const statusGroups = await prisma.application.groupBy({
    by: ["jobId", "status"],
    where: { jobId: { in: jobIds } },
    _count: true,
    _max: { updatedAt: true },
  });

  // Uma consulta: toda candidatura em andamento, com a etapa atual e desde quando está nela.
  const openStageRows = await prisma.applicationStageHistory.findMany({
    where: { exitedAt: null, application: { jobId: { in: jobIds }, status: "IN_PROGRESS" } },
    select: {
      applicationId: true,
      enteredAt: true,
      stage: { select: { type: true } },
      application: { select: { jobId: true } },
    },
  });

  // Uma consulta: quem já enviou o teste de código, entre quem está na etapa CODE_TEST agora.
  const codeTestAppIds = openStageRows.filter((r) => r.stage.type === "CODE_TEST").map((r) => r.applicationId);
  const submissions = codeTestAppIds.length
    ? await prisma.codeSubmission.findMany({ where: { applicationId: { in: codeTestAppIds } }, select: { applicationId: true } })
    : [];
  const submittedAppIds = new Set(submissions.map((s) => s.applicationId));

  // Uma consulta: contratações (aprovados na etapa mais recente que alcançaram) para
  // "contratações no período" e "tempo médio até contratar".
  const approvalHistory = await prisma.applicationStageHistory.findMany({
    where: { exitedAt: { not: null }, application: { status: "APPROVED", jobId: { in: jobIds } } },
    select: { applicationId: true, enteredAt: true, exitedAt: true, application: { select: { jobId: true, appliedAt: true } } },
    orderBy: { enteredAt: "desc" },
  });
  // A entrada mais recente por candidatura é a etapa de onde ela foi aprovada (a contratação).
  const hireByApplication = new Map<string, { jobId: string; appliedAt: Date; hiredAt: Date }>();
  for (const row of approvalHistory) {
    if (hireByApplication.has(row.applicationId)) continue;
    hireByApplication.set(row.applicationId, { jobId: row.application.jobId, appliedAt: row.application.appliedAt, hiredAt: row.exitedAt! });
  }

  // Agrupa as consultas acima por vaga antes de montar cada linha.
  const statusByJob = new Map<string, Map<string, { count: number; maxUpdatedAt: Date | null }>>();
  for (const g of statusGroups) {
    const byStatus = statusByJob.get(g.jobId) ?? new Map();
    byStatus.set(g.status, { count: g._count, maxUpdatedAt: g._max.updatedAt });
    statusByJob.set(g.jobId, byStatus);
  }
  const openStageByJob = new Map<string, typeof openStageRows>();
  for (const row of openStageRows) {
    const list = openStageByJob.get(row.application.jobId) ?? [];
    list.push(row);
    openStageByJob.set(row.application.jobId, list);
  }
  const hiresByJob = new Map<string, Array<{ appliedAt: Date; hiredAt: Date }>>();
  for (const hire of hireByApplication.values()) {
    const list = hiresByJob.get(hire.jobId) ?? [];
    list.push(hire);
    hiresByJob.set(hire.jobId, list);
  }

  const rows: JobOverviewRow[] = jobs.map((job) => {
    const byStatus = statusByJob.get(job.id) ?? new Map();
    const approvedCount = byStatus.get("APPROVED")?.count ?? 0;
    const rejectedCount = byStatus.get("REJECTED")?.count ?? 0;
    const totalCandidates = [...byStatus.values()].reduce((sum, v) => sum + v.count, 0);
    const decided = approvedCount + rejectedCount;
    const conversionRate = decided > 0 ? Number((approvedCount / decided).toFixed(2)) : null;

    const openRows = openStageByJob.get(job.id) ?? [];
    const countByStageType = new Map<string, number>();
    const enteredAtsByStageType = new Map<string, Date[]>();
    for (const row of openRows) {
      countByStageType.set(row.stage.type, (countByStageType.get(row.stage.type) ?? 0) + 1);
      const list = enteredAtsByStageType.get(row.stage.type) ?? [];
      list.push(row.enteredAt);
      enteredAtsByStageType.set(row.stage.type, list);
    }
    const byStage: JobOverviewStageCount[] = job.stages.map((stage) => ({
      stageType: stage.type,
      count: countByStageType.get(stage.type) ?? 0,
    }));

    let bottleneck: JobOverviewBottleneck | null = null;
    for (const [stageType, count] of countByStageType) {
      if (!bottleneck || count > bottleneck.count) {
        const waits = enteredAtsByStageType.get(stageType) ?? [];
        const avgHours = waits.reduce((sum, d) => sum + (now.getTime() - d.getTime()) / HOUR_MS, 0) / waits.length;
        bottleneck = { stageType, count, avgHoursWaiting: Number(avgHours.toFixed(1)) };
      }
    }

    const codeTestInStage = countByStageType.get("CODE_TEST") ?? 0;
    const codeTestPending = openRows.filter((r) => r.stage.type === "CODE_TEST" && !submittedAppIds.has(r.applicationId)).length;
    const codeTestSubmitted = codeTestInStage - codeTestPending;
    const inProgressTotal = byStatus.get("IN_PROGRESS")?.count ?? 0;
    const awaitingDecision = inProgressTotal - codeTestPending;

    const maxAppUpdatedAt = [...byStatus.values()].reduce<Date | null>((max, v) => {
      if (!v.maxUpdatedAt) return max;
      return !max || v.maxUpdatedAt > max ? v.maxUpdatedAt : max;
    }, null);
    const lastActivityAt = maxAppUpdatedAt && maxAppUpdatedAt > job.updatedAt ? maxAppUpdatedAt : job.updatedAt;
    const daysSinceActivity = Math.floor((now.getTime() - lastActivityAt.getTime()) / DAY_MS);

    let daysOpen: number | null = null;
    if (job.status !== "DRAFT") {
      const start = job.publishedAt ?? job.createdAt;
      // Encerrada: não há campo "closedAt" (sem migration). updatedAt é o melhor proxy —
      // tanto o encerramento manual quanto o automático (vaga preenchida) atualizam a vaga
      // na própria transação que a fecha.
      const end = job.status === "CLOSED" ? job.updatedAt : now;
      daysOpen = Math.floor((end.getTime() - start.getTime()) / DAY_MS);
    }

    const finalStage = job.stages.find((s) => s.type === "FINAL_OFFER");
    const positionsTotal = finalStage ? positionsOf(finalStage.config) : null;

    return {
      id: job.id,
      title: job.title,
      status: job.status,
      recruiter: job.createdBy,
      createdAt: job.createdAt.toISOString(),
      publishedAt: job.publishedAt?.toISOString() ?? null,
      daysOpen,
      totalCandidates,
      byStage,
      approvedCount,
      rejectedCount,
      conversionRate,
      bottleneck,
      awaitingDecision,
      codeTestPending,
      codeTestSubmitted,
      lastActivityAt: lastActivityAt.toISOString(),
      daysSinceActivity,
      positionsFilled: approvedCount,
      positionsTotal,
    };
  });

  const openJobs = rows.filter((r) => r.status === "PUBLISHED").length;
  const activeCandidates = rows.reduce((sum, r) => sum + (statusByJob.get(r.id)?.get("IN_PROGRESS")?.count ?? 0), 0);
  const awaitingDecisionTotal = rows.reduce((sum, r) => sum + r.awaitingDecision, 0);

  const allHires = [...hiresByJob.values()].flat();
  const hiresInPeriod = allHires.filter((h) => inPeriod(h.hiredAt, from, to));
  const avgDaysToHire =
    hiresInPeriod.length > 0
      ? Number((hiresInPeriod.reduce((sum, h) => sum + (h.hiredAt.getTime() - h.appliedAt.getTime()) / DAY_MS, 0) / hiresInPeriod.length).toFixed(1))
      : null;

  return {
    summary: { openJobs, activeCandidates, awaitingDecision: awaitingDecisionTotal, hiresInPeriod: hiresInPeriod.length, avgDaysToHire },
    jobs: rows,
    recruiters,
  };
}
