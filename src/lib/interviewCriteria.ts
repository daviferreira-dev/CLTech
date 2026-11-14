// Spec 009 (FR-902): critérios da ficha de entrevista, fixos por tipo de etapa — todos os
// entrevistadores avaliam com a mesma régua (dor "cada avaliador tem uma opinião" da 3aq).
// Mudar um critério muda a ficha de todo mundo: fichas antigas mantêm as chaves que tinham.

export const INTERVIEW_SCORE_MIN = 1;
export const INTERVIEW_SCORE_MAX = 5;
export const INTERVIEW_COMMENT_MAX = 2000;

export interface InterviewCriterion {
  key: string;
  label: string;
  /**
   * Dica ao entrevistador, só na tela: não entra na nota nem no que é gravado. Perguntas sobre
   * trabalho e competência; nada de idade, família, gravidez, religião, saúde, origem ou outro
   * dado sensível (LGPD art. 11 — tests/unit/interview-criteria.test.ts barra os termos).
   */
  questions: readonly string[];
}

export const INTERVIEW_CRITERIA: Record<string, readonly InterviewCriterion[]> = {
  HR_INTERVIEW: [
    {
      key: "comunicacao",
      label: "Comunicação",
      questions: [
        "Conte sobre uma vez em que você precisou explicar algo complicado para alguém de outra área. Como fez?",
        "Como você costuma avisar o time quando uma entrega vai atrasar?",
      ],
    },
    {
      key: "motivacao",
      label: "Motivação",
      questions: [
        "O que chamou sua atenção nesta vaga?",
        "Qual projeto ou tarefa recente você mais gostou de fazer, e por quê?",
        "O que você quer aprender ou desenvolver nos próximos anos de carreira?",
      ],
    },
    {
      key: "alinhamento",
      label: "Alinhamento com a vaga",
      questions: [
        "Pelo que você leu da vaga, quais atividades você já fez e quais seriam novas para você?",
        "Como você prefere trabalhar em equipe: que tipo de rotina e combinado funciona melhor para você?",
      ],
    },
  ],
  TECH_INTERVIEW: [
    {
      key: "logica",
      label: "Lógica e resolução de problemas",
      questions: [
        "Fale de um problema difícil que você resolveu. Por onde começou e como chegou à solução?",
        "Quando você trava num erro que não entende, quais passos segue?",
      ],
    },
    {
      key: "conhecimento",
      label: "Conhecimento técnico",
      questions: [
        "Das tecnologias da vaga, qual você usou mais? Conte um caso real em que ela fez diferença.",
        "Que escolha técnica você faria diferente num projeto passado, sabendo o que sabe hoje?",
      ],
    },
    {
      key: "qualidade",
      label: "Qualidade de código e arquitetura",
      questions: [
        "Como você decide que um código está pronto para revisão?",
        "Que tipo de teste você costuma escrever, e em que situação acha que vale a pena?",
        "Como você organizaria um sistema pequeno para ser fácil de mudar depois?",
      ],
    },
    {
      key: "comunicacao_tecnica",
      label: "Comunicação técnica",
      questions: [
        "Explique uma decisão técnica sua como se eu fosse alguém do produto, sem jargão.",
        "Como você reage quando alguém discorda do seu código numa revisão?",
      ],
    },
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
