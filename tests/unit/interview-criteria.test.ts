import { describe, it, expect } from "vitest";
import { INTERVIEW_CRITERIA, averageScore, validateInterviewScores } from "@/lib/interviewCriteria";

describe("validateInterviewScores", () => {
  const hr = { comunicacao: 4, motivacao: 5, alinhamento: 3 };

  it("aceita exatamente os critérios da etapa, de 1 a 5", () => {
    expect(validateInterviewScores("HR_INTERVIEW", hr)).toBeNull();
  });

  it("recusa etapa sem ficha, critério faltando, a mais, fora da faixa ou não inteiro", () => {
    expect(validateInterviewScores("CODE_TEST", hr)).not.toBeNull();
    expect(validateInterviewScores("HR_INTERVIEW", { comunicacao: 4, motivacao: 5 })).toContain("Alinhamento");
    expect(validateInterviewScores("HR_INTERVIEW", { ...hr, logica: 3 })).not.toBeNull();
    expect(validateInterviewScores("HR_INTERVIEW", { ...hr, motivacao: 6 })).not.toBeNull();
    expect(validateInterviewScores("HR_INTERVIEW", { ...hr, motivacao: 3.5 })).not.toBeNull();
  });
});

describe("averageScore", () => {
  it("uma casa decimal; null sem notas", () => {
    expect(averageScore([4, 5, 3, 4])).toBe(4);
    expect(averageScore([4, 5])).toBe(4.5);
    expect(averageScore([1, 2, 2])).toBe(1.7);
    expect(averageScore([])).toBeNull();
  });
});

describe("perguntas sugeridas", () => {
  const all = Object.values(INTERVIEW_CRITERIA).flat();
  // Termos que indicam pergunta sobre dado sensível ou vida pessoal (LGPD art. 11).
  const SENSITIVE = /\bidade\b|anos você tem|nasc|famíl|filh|casad|marid|espos|namor|grávid|gravidez|gestante|religi|igreja|saúde|doença|deficiên|remédio|origem|naturalidade|etnia|raça|cor da pele|sexual|gênero|partido|polític|sindicat/i;

  it("cada critério tem de 2 a 3 perguntas, sem repetir", () => {
    for (const c of all) {
      expect(c.questions.length, c.key).toBeGreaterThanOrEqual(2);
      expect(c.questions.length, c.key).toBeLessThanOrEqual(3);
    }
    const questions = all.flatMap((c) => c.questions);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("nenhuma pergunta toca em dado sensível ou vida pessoal", () => {
    for (const q of all.flatMap((c) => c.questions)) expect(q).not.toMatch(SENSITIVE);
  });
});
