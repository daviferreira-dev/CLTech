import { describe, it, expect } from "vitest";
import { STAGE_TYPES } from "@/lib/processStages";
import {
  EMAIL_MOMENTS,
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_MOMENT_LABEL,
  EMAIL_MOMENT_VARIABLES,
  JOB_CONFIGURABLE_MOMENTS,
  stageAdvancedMoment,
} from "@/lib/emailMoments";

describe("stageAdvancedMoment", () => {
  it("monta um momento STAGE_ADVANCED_* válido para cada tipo de etapa", () => {
    for (const type of STAGE_TYPES) {
      expect(EMAIL_MOMENTS).toContain(stageAdvancedMoment(type));
    }
  });
});

describe("consistência das tabelas por momento", () => {
  it("DEFAULT_EMAIL_TEMPLATES, EMAIL_MOMENT_LABEL e EMAIL_MOMENT_VARIABLES têm as mesmas chaves que EMAIL_MOMENTS", () => {
    for (const moment of EMAIL_MOMENTS) {
      expect(DEFAULT_EMAIL_TEMPLATES[moment]).toBeTruthy();
      expect(DEFAULT_EMAIL_TEMPLATES[moment].subject.length).toBeGreaterThan(0);
      expect(DEFAULT_EMAIL_TEMPLATES[moment].body.length).toBeGreaterThan(0);
      expect(EMAIL_MOMENT_LABEL[moment]).toBeTruthy();
      expect(EMAIL_MOMENT_VARIABLES[moment].length).toBeGreaterThan(0);
    }
  });

  it("candidatura recebida e vaga encerrada não são configuráveis por vaga (só o padrão da biblioteca)", () => {
    expect(JOB_CONFIGURABLE_MOMENTS.has("APPLICATION_RECEIVED")).toBe(false);
    expect(JOB_CONFIGURABLE_MOMENTS.has("JOB_CLOSED")).toBe(false);
    expect(JOB_CONFIGURABLE_MOMENTS.has("REJECTED")).toBe(true);
    expect(JOB_CONFIGURABLE_MOMENTS.has("APPROVED")).toBe(true);
  });
});
