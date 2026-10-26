// Catálogo fixo dos 6 tipos de etapa do processo seletivo (RF04).
export const STAGE_TYPES = [
  "RESUME_ANALYSIS",
  "CODE_TEST",
  "GITHUB_ANALYSIS",
  "HR_INTERVIEW",
  "TECH_INTERVIEW",
  "FINAL_OFFER",
] as const;

export type StageType = (typeof STAGE_TYPES)[number];

export const STAGE_LABEL: Record<string, string> = {
  RESUME_ANALYSIS: "Análise de Currículo",
  CODE_TEST: "Teste de Código",
  GITHUB_ANALYSIS: "Análise de GitHub",
  HR_INTERVIEW: "Entrevista de RH",
  TECH_INTERVIEW: "Entrevista Técnica",
  FINAL_OFFER: "Proposta Final",
};

/** Quantas pessoas a Proposta Final contrata: a vaga só fecha ao aprovar todas (padrão 1). */
export const MIN_POSITIONS = 1;
export const MAX_POSITIONS = 100;

export function positionsOf(config: unknown): number {
  const value = (config as { positions?: unknown } | null | undefined)?.positions;
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_POSITIONS && value <= MAX_POSITIONS
    ? value
    : MIN_POSITIONS;
}

/** Match mínimo (%) para a listagem do recrutador recomendar o candidato. */
export const RECOMMENDATION_THRESHOLD = 70;

/** Etapas de entrevista: ao mover o candidato para elas, o recrutador informa data e link da reunião. */
export const INTERVIEW_STAGES: readonly string[] = ["HR_INTERVIEW", "TECH_INTERVIEW"];
