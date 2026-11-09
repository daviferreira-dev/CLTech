// Spec 009 (FR-902): critérios da ficha de entrevista, fixos por tipo de etapa — todos os
// entrevistadores avaliam com a mesma régua (dor "cada avaliador tem uma opinião" da 3aq).
// Mudar um critério muda a ficha de todo mundo: fichas antigas mantêm as chaves que tinham.

export const INTERVIEW_SCORE_MIN = 1;
export const INTERVIEW_SCORE_MAX = 5;
export const INTERVIEW_COMMENT_MAX = 2000;

export interface InterviewCriterion {
  key: string;
  label: string;
}

export const INTERVIEW_CRITERIA: Record<string, readonly InterviewCriterion[]> = {
  HR_INTERVIEW: [
    { key: "comunicacao", label: "Comunicação" },
    { key: "motivacao", label: "Motivação" },
    { key: "alinhamento", label: "Alinhamento com a vaga" },
  ],
  TECH_INTERVIEW: [
    { key: "logica", label: "Lógica e resolução de problemas" },
    { key: "conhecimento", label: "Conhecimento técnico" },
    { key: "qualidade", label: "Qualidade de código e arquitetura" },
    { key: "comunicacao_tecnica", label: "Comunicação técnica" },
  ],
};

export const INTERVIEW_RECOMMENDATION_LABEL: Record<string, string> = {
  ADVANCE: "Avançar",
  UNSURE: "Em dúvida",
  REJECT: "Não avançar",
};

/** Mensagem de erro, ou null se as notas batem exatamente com os critérios da etapa. */
export function validateInterviewScores(stageType: string, scores: Record<string, unknown>): string | null {
  const criteria = INTERVIEW_CRITERIA[stageType];
  if (!criteria) return "Esta etapa não tem ficha de entrevista.";
  const expected = new Set(criteria.map((c) => c.key));
  for (const key of Object.keys(scores)) {
    if (!expected.has(key)) return "A ficha tem um critério que não pertence a esta etapa.";
  }
  for (const { key, label } of criteria) {
    const value = scores[key];
    if (!Number.isInteger(value) || (value as number) < INTERVIEW_SCORE_MIN || (value as number) > INTERVIEW_SCORE_MAX) {
      return `Dê uma nota de ${INTERVIEW_SCORE_MIN} a ${INTERVIEW_SCORE_MAX} para "${label}".`;
    }
  }
  return null;
}

/** Média com uma casa decimal; null sem notas. */
export function averageScore(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}
