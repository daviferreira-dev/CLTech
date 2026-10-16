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
