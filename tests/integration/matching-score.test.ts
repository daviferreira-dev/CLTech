// R12: score determinístico — mesma entrada produz mesmo resultado; pesos 60/40;
// reponderação correta quando falta um dos dois sinais.
import { describe, it, expect } from "vitest";
import { computeScore } from "@/server/matching/score";

const JOB_TECHNOLOGIES = ["React", "Node", "Docker"];

describe("computeScore (R12)", () => {
  it("é determinístico — mesma entrada produz sempre o mesmo resultado", () => {
    const signals = {
      resumeText: "Desenvolvedor com experiência em React e Node.js.",
      githubLanguages: [{ name: "Docker", share: 0.3 }],
    };

    const first = computeScore(JOB_TECHNOLOGIES, signals);
    const second = computeScore(JOB_TECHNOLOGIES, signals);
    expect(first).toEqual(second);
  });

  it("combina currículo (60%) e GitHub (40%) quando ambos existem", () => {
    const result = computeScore(JOB_TECHNOLOGIES, {
      resumeText: "React e Node no currículo.", // 2/3 tecnologias = 0.666
      githubLanguages: [{ name: "Docker", share: 1 }], // 1/3 tecnologias = 0.333
    });

    // 0.6 * 0.666 + 0.4 * 0.333 = 0.4 + 0.133 = 0.533 → 53
    expect(result?.score).toBe(53);
    expect(result?.matched.sort()).toEqual(["Docker", "Node", "React"]);
    expect(result?.missing).toEqual([]);
  });

  it("usa só o currículo (peso 1.0) quando não há GitHub", () => {
    const result = computeScore(JOB_TECHNOLOGIES, {
      resumeText: "React e Node no currículo.",
      githubLanguages: null,
    });

    expect(result?.score).toBe(67); // 2/3 arredondado
    expect(result?.missing).toEqual(["Docker"]);
  });

  it("usa só o GitHub (peso 1.0) quando não há texto de currículo", () => {
    const result = computeScore(JOB_TECHNOLOGIES, {
      resumeText: null,
      githubLanguages: [
        { name: "React", share: 0.5 },
        { name: "Node", share: 0.5 },
      ],
    });

    // (0.5 + 0.5 + 0) / 3 tecnologias = 0.333... → 33
    expect(result?.score).toBe(33);
    expect(result?.matched.sort()).toEqual(["Node", "React"]);
    expect(result?.missing).toEqual(["Docker"]);
  });

  it("retorna null quando nenhum sinal existe — não é score zero (FR-036)", () => {
    const result = computeScore(JOB_TECHNOLOGIES, { resumeText: null, githubLanguages: null });
    expect(result).toBeNull();
  });

  it("não quebra com lista de tecnologias vazia", () => {
    const result = computeScore([], { resumeText: "qualquer coisa", githubLanguages: null });
    expect(result).toEqual({ score: 0, matched: [], missing: [] });
  });

  it("faz correspondência por palavra inteira, não substring (case-insensitive)", () => {
    const result = computeScore(["Go"], {
      resumeText: "Trabalhei com Google Cloud e Golang.", // "Go" não deveria casar aqui
      githubLanguages: null,
    });
    expect(result?.matched).toEqual([]);
    expect(result?.missing).toEqual(["Go"]);

    const matchResult = computeScore(["Go"], { resumeText: "Experiência com Go e concorrência.", githubLanguages: null });
    expect(matchResult?.matched).toEqual(["Go"]);
  });
});
