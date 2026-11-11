// Spec 010 (FR-1001..1003): regras puras do tempo do anúncio à proposta e dos candidatos parados.
import { describe, expect, it } from "vitest";
import {
  STALLED_DAYS,
  daysToOffer,
  stalledDaysFrom,
  summarizeTimeToOffer,
  timeToOfferVerdict,
  waitingOnFor,
} from "@/lib/velocity";

const DAY = 86_400_000;
const t0 = new Date("2026-11-01T12:00:00Z");
const after = (days: number) => new Date(t0.getTime() + days * DAY);

describe("daysToOffer (FR-1001 / D1)", () => {
  it("conta da publicação até a primeira entrada na Proposta Final", () => {
    expect(
      daysToOffer({ publishedAt: t0, hasFinalOfferStage: true, finalOfferEnteredAt: [after(12), after(9)], approvedAt: [after(20)] }),
    ).toBe(9);
  });

  it("sem etapa de Proposta Final, usa a primeira aprovação", () => {
    expect(daysToOffer({ publishedAt: t0, hasFinalOfferStage: false, finalOfferEnteredAt: [], approvedAt: [after(15), after(6.5)] })).toBe(6.5);
  });

  it("com etapa de Proposta Final, aprovação sem entrada nela não conta", () => {
    expect(daysToOffer({ publishedAt: t0, hasFinalOfferStage: true, finalOfferEnteredAt: [], approvedAt: [after(4)] })).toBeNull();
  });

  it("vaga nunca publicada ou que ninguém alcançou fica de fora", () => {
    expect(daysToOffer({ publishedAt: null, hasFinalOfferStage: true, finalOfferEnteredAt: [after(3)], approvedAt: [] })).toBeNull();
    expect(daysToOffer({ publishedAt: t0, hasFinalOfferStage: false, finalOfferEnteredAt: [], approvedAt: [] })).toBeNull();
  });
});

describe("summarizeTimeToOffer", () => {
  it("sem nenhuma vaga na conta, a média é null (nunca 0 nem NaN)", () => {
    const result = summarizeTimeToOffer([], { HIRING_BASELINE_DAYS: "45" });
    expect(result).toEqual({ avgDays: null, jobsCounted: 0, baselineDays: 45, baselineLabel: "Referência de mercado", reductionPct: null });
  });

  it("média com uma casa e percentual abaixo da referência", () => {
    const result = summarizeTimeToOffer([10, 12.5, 15], { HIRING_BASELINE_DAYS: "45", HIRING_BASELINE_LABEL: "Ford/Datafolha 2026" });
    expect(result).toEqual({ avgDays: 12.5, jobsCounted: 3, baselineDays: 45, baselineLabel: "Ford/Datafolha 2026", reductionPct: 72 });
  });

  it("acima da referência, o percentual fica negativo", () => {
    expect(summarizeTimeToOffer([60], { HIRING_BASELINE_DAYS: "45" }).reductionPct).toBe(-33);
  });

  it("referência ausente ou inválida desliga a comparação", () => {
    for (const value of [undefined, "", "abc", "0", "-5"]) {
      const result = summarizeTimeToOffer([10], { HIRING_BASELINE_DAYS: value });
      expect(result.baselineDays).toBeNull();
      expect(result.reductionPct).toBeNull();
    }
  });
});

describe("timeToOfferVerdict (US1.2–1.4)", () => {
  const base = { jobsCounted: 1, baselineLabel: "Referência de mercado" };

  it("metade ou menos da referência", () => {
    expect(timeToOfferVerdict({ ...base, avgDays: 20, baselineDays: 45, reductionPct: 56 })).toBe(
      "Referência de mercado: 45 dias · 56% abaixo. Metade ou menos da referência.",
    );
  });

  it("acima da metade, diz quantos dias faltam para chegar nela", () => {
    expect(timeToOfferVerdict({ ...base, avgDays: 30, baselineDays: 45, reductionPct: 33 })).toBe(
      "Referência de mercado: 45 dias · 33% abaixo. Faltam 7,5 dias para chegar à metade.",
    );
  });

  it("acima da própria referência", () => {
    expect(timeToOfferVerdict({ ...base, avgDays: 60, baselineDays: 45, reductionPct: -33 })).toBe(
      "Referência de mercado: 45 dias · 33% acima. Faltam 37,5 dias para chegar à metade.",
    );
  });

  it("sem referência configurada", () => {
    expect(timeToOfferVerdict({ ...base, avgDays: 30, baselineDays: null, reductionPct: null })).toBe("Sem referência configurada.");
  });
});

describe("candidato parado (FR-1002 / FR-1003 / D4)", () => {
  it("o limite padrão é 7 dias e pode vir de STALLED_CANDIDATE_DAYS", () => {
    expect(STALLED_DAYS).toBe(7);
    expect(stalledDaysFrom({})).toBe(7);
    expect(stalledDaysFrom({ STALLED_CANDIDATE_DAYS: "10" })).toBe(10);
    expect(stalledDaysFrom({ STALLED_CANDIDATE_DAYS: "zero" })).toBe(7);
    expect(stalledDaysFrom({ STALLED_CANDIDATE_DAYS: "0" })).toBe(7);
  });

  it("etapa que não é teste de código espera o RH", () => {
    expect(waitingOnFor({ stageType: "HR_INTERVIEW", submitted: false, draftStartedAt: null, timeLimitMinutes: 60, now: t0 })).toBe("RECRUITER");
  });

  it("teste de código não aberto ou dentro do prazo espera o candidato", () => {
    expect(waitingOnFor({ stageType: "CODE_TEST", submitted: false, draftStartedAt: null, timeLimitMinutes: 60, now: t0 })).toBe("CANDIDATE");
    expect(
      waitingOnFor({ stageType: "CODE_TEST", submitted: false, draftStartedAt: new Date(t0.getTime() - 30 * 60_000), timeLimitMinutes: 60, now: t0 }),
    ).toBe("CANDIDATE");
  });

  it("teste de código enviado ou com prazo vencido espera o RH", () => {
    expect(waitingOnFor({ stageType: "CODE_TEST", submitted: true, draftStartedAt: null, timeLimitMinutes: 60, now: t0 })).toBe("RECRUITER");
    expect(
      waitingOnFor({ stageType: "CODE_TEST", submitted: false, draftStartedAt: new Date(t0.getTime() - 2 * 3_600_000), timeLimitMinutes: 60, now: t0 }),
    ).toBe("RECRUITER");
  });
});
