// RF07 / FR-043..046 — painel consolidado. Métricas por agregação SQL/leitura única,
// nunca texto gerado livremente (D4 da Sprint 1) e sem N+1 (R15).
import { prisma } from "@/lib/prisma";

export interface DashboardJob {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  candidatesByStage: Array<{ stageType: string; count: number }>;
}

export interface DashboardFunnel {
  avgTimePerStageHours: Array<{ stageType: string; hours: number }>;
  advanceRatePerStage: Array<{ stageType: string; rate: number }>;
  bottleneckStageType: string | null;
}

export interface DashboardResult {
  jobs: DashboardJob[];
  funnel: DashboardFunnel;
}

export async function getDashboard(jobId?: string): Promise<DashboardResult> {
  const jobs = await prisma.job.findMany({
    where: jobId ? { id: jobId } : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      stages: { select: { id: true, type: true, order: true }, orderBy: { order: "asc" } },
      applications: { where: { status: "IN_PROGRESS" }, select: { currentStageId: true } },
    },
  });

  const dashboardJobs: DashboardJob[] = jobs.map((job) => {
    const countByStageId = new Map<string, number>();
    for (const app of job.applications) {
      countByStageId.set(app.currentStageId, (countByStageId.get(app.currentStageId) ?? 0) + 1);
    }
    return {
      id: job.id,
      title: job.title,
      status: job.status,
      // Inclui toda etapa configurada, mesmo com zero movimentação (FR-045, R15).
      candidatesByStage: job.stages.map((stage) => ({
        stageType: stage.type,
        count: countByStageId.get(stage.id) ?? 0,
      })),
    };
  });

  const funnel = await computeFunnel(jobId ? [jobId] : jobs.map((job) => job.id));

  return { jobs: dashboardJobs, funnel };
}

async function computeFunnel(jobIds: string[]): Promise<DashboardFunnel> {
  if (jobIds.length === 0) {
    return { avgTimePerStageHours: [], advanceRatePerStage: [], bottleneckStageType: null };
  }

  // Uma única leitura: histórico + etapa (tipo/ordem) + status final da candidatura.
  const history = await prisma.applicationStageHistory.findMany({
    where: { stage: { jobId: { in: jobIds } } },
    select: {
      applicationId: true,
      enteredAt: true,
      exitedAt: true,
      stage: { select: { type: true, order: true } },
      application: { select: { status: true } },
    },
  });

  const maxOrderReachedByApplication = new Map<string, number>();
  for (const row of history) {
    const current = maxOrderReachedByApplication.get(row.applicationId) ?? -1;
    if (row.stage.order > current) maxOrderReachedByApplication.set(row.applicationId, row.stage.order);
  }

  const hoursByType = new Map<string, number[]>();
  const decidedByType = new Map<string, { advanced: number; total: number }>();

  for (const row of history) {
    if (!row.exitedAt) continue; // ainda na etapa — não entra nas métricas de saída

    const hours = (row.exitedAt.getTime() - row.enteredAt.getTime()) / 3_600_000;
    const list = hoursByType.get(row.stage.type) ?? [];
    list.push(hours);
    hoursByType.set(row.stage.type, list);

    const maxOrderReached = maxOrderReachedByApplication.get(row.applicationId) ?? row.stage.order;
    const advanced = maxOrderReached > row.stage.order || row.application.status === "APPROVED";
    const bucket = decidedByType.get(row.stage.type) ?? { advanced: 0, total: 0 };
    bucket.total += 1;
    if (advanced) bucket.advanced += 1;
    decidedByType.set(row.stage.type, bucket);
  }

  const avgTimePerStageHours = [...hoursByType.entries()].map(([stageType, hours]) => ({
    stageType,
    hours: Number((hours.reduce((sum, h) => sum + h, 0) / hours.length).toFixed(1)),
  }));

  const advanceRatePerStage = [...decidedByType.entries()].map(([stageType, { advanced, total }]) => ({
    stageType,
    rate: Number((advanced / total).toFixed(2)),
  }));

  const bottleneckStageType =
    avgTimePerStageHours.length > 0
      ? avgTimePerStageHours.reduce((max, item) => (item.hours > max.hours ? item : max)).stageType
      : null;

  return { avgTimePerStageHours, advanceRatePerStage, bottleneckStageType };
}
