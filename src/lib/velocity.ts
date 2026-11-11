// Spec 010 — regras puras da meta de tempo da 3aq e dos candidatos parados. Usado pelo servidor
// (src/server/jobs/metrics.ts e stalled.ts) e pelas telas. Nada aqui depende de Prisma.

const DAY_MS = 86_400_000;

/** FR-1003: "parado" = sem sair da etapa há mais que isto. Um número só, para candidato e vaga. */
export const STALLED_DAYS = 7;

type Env = Record<string, string | undefined>;

function positiveNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Lê STALLED_CANDIDATE_DAYS no servidor; ausente ou inválido cai no padrão. */
export function stalledDaysFrom(env: Env): number {
  return positiveNumber(env.STALLED_CANDIDATE_DAYS) ?? STALLED_DAYS;
}

export interface JobOfferTimeline {
  publishedAt: Date | null;
  hasFinalOfferStage: boolean;
  /** Entradas de candidaturas na etapa Proposta Final. */
  finalOfferEnteredAt: Date[];
  /** Momento em que cada candidatura aprovada foi aprovada. */
  approvedAt: Date[];
}

function earliest(dates: Date[]): Date | null {
  return dates.reduce<Date | null>((min, d) => (!min || d < min ? d : min), null);
}

/**
 * D1: dias entre a publicação e a primeira candidatura que entra na Proposta Final — ou que é
 * aprovada, quando a vaga não tem essa etapa. Null: vaga fora da conta (não publicada ou ninguém
 * chegou lá ainda).
 */
export function daysToOffer(job: JobOfferTimeline): number | null {
  if (!job.publishedAt) return null;
  const reached = earliest(job.hasFinalOfferStage ? job.finalOfferEnteredAt : job.approvedAt);
  if (!reached) return null;
  return Math.max(0, (reached.getTime() - job.publishedAt.getTime()) / DAY_MS);
}

export interface TimeToOffer {
  avgDays: number | null;
  jobsCounted: number;
  baselineDays: number | null;
  baselineLabel: string;
  /** Quanto a média está abaixo da referência, em %. Negativo: acima dela. */
  reductionPct: number | null;
}

export const DEFAULT_BASELINE_LABEL = "Referência de mercado";

/** FR-1001: média por vaga e comparação com a referência de mercado (D2). */
export function summarizeTimeToOffer(daysPerJob: number[], env: Env): TimeToOffer {
  const baselineDays = positiveNumber(env.HIRING_BASELINE_DAYS);
  const baselineLabel = env.HIRING_BASELINE_LABEL?.trim() || DEFAULT_BASELINE_LABEL;
  if (daysPerJob.length === 0) {
    return { avgDays: null, jobsCounted: 0, baselineDays, baselineLabel, reductionPct: null };
  }
  const avg = daysPerJob.reduce((sum, d) => sum + d, 0) / daysPerJob.length;
  return {
    avgDays: Number(avg.toFixed(1)),
    jobsCounted: daysPerJob.length,
    baselineDays,
    baselineLabel,
    reductionPct: baselineDays ? Math.round((1 - avg / baselineDays) * 100) : null,
  };
}

export function formatDays(days: number): string {
  return days.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

/** US1.2–1.4: frase do card. Nunca chama a referência de "tempo da 3aq" (D2). */
export function timeToOfferVerdict(t: Pick<TimeToOffer, "avgDays" | "baselineDays" | "baselineLabel" | "reductionPct">): string {
  if (t.baselineDays === null || t.reductionPct === null || t.avgDays === null) return "Sem referência configurada.";
  const comparison = `${t.baselineLabel}: ${formatDays(t.baselineDays)} dias · ${Math.abs(t.reductionPct)}% ${t.reductionPct >= 0 ? "abaixo" : "acima"}.`;
  const half = t.baselineDays / 2;
  if (t.avgDays <= half) return `${comparison} Metade ou menos da referência.`;
  return `${comparison} Faltam ${formatDays(Number((t.avgDays - half).toFixed(1)))} dias para chegar à metade.`;
}

export type WaitingOn = "RECRUITER" | "CANDIDATE";

/**
 * D4: teste de código liberado e não enviado, dentro do prazo (ou nem aberto), é espera do
 * candidato — o RH não tem o que fazer. Enviado ou com prazo vencido, a vez é do RH.
 */
export function waitingOnFor(input: {
  stageType: string;
  submitted: boolean;
  draftStartedAt: Date | null;
  timeLimitMinutes: number;
  now: Date;
}): WaitingOn {
  if (input.stageType !== "CODE_TEST" || input.submitted) return "RECRUITER";
  if (!input.draftStartedAt) return "CANDIDATE";
  const deadline = input.draftStartedAt.getTime() + input.timeLimitMinutes * 60_000;
  return input.now.getTime() < deadline ? "CANDIDATE" : "RECRUITER";
}
