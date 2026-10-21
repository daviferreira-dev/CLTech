import { describe, expect, it } from "vitest";
import { emptyExperience, mergeDraft, toPayload, type ProfileDraft, type ProfileFormState } from "@/lib/profile-form";
import { formatMonth, formatPeriod } from "@/lib/profile-details";

const baseForm = (): ProfileFormState => ({
  name: "Maria",
  phone: "",
  city: "Campinas",
  state: "SP",
  headline: "",
  summary: "",
  technologies: ["React"],
  softSkills: [],
  experiences: [],
  educations: [{ institution: "USP", course: "Computação", level: "GRADUACAO", startDate: "", endDate: "", inProgress: false }],
  languages: [],
  links: [],
});

const draft: ProfileDraft = {
  phone: "(11) 98765-4321",
  city: "São Paulo",
  headline: "Dev Backend",
  technologies: ["react", "Node.js"],
  softSkills: ["Comunicação"],
  experiences: [{ ...emptyExperience(), company: "Acme", role: "Dev", startDate: "2021-03", isCurrent: true }],
  educations: [{ institution: "Unicamp", course: "Engenharia", level: "GRADUACAO", startDate: "", endDate: "", inProgress: false }],
  languages: [{ name: "Inglês", level: "AVANCADO" }],
  links: [],
};

describe("mergeDraft", () => {
  const { form, filled } = mergeDraft(baseForm(), draft);

  it("preenche só campos vazios", () => {
    expect(form.phone).toBe("(11) 98765-4321");
    expect(form.headline).toBe("Dev Backend");
    expect(form.city).toBe("Campinas");
  });

  it("preenche lista vazia e não mexe em lista já preenchida", () => {
    expect(form.experiences).toHaveLength(1);
    expect(form.educations).toEqual(baseForm().educations);
    expect(form.languages).toEqual([{ name: "Inglês", level: "AVANCADO" }]);
  });

  it("une tags sem duplicar, ignorando caixa", () => {
    expect(form.technologies).toEqual(["React", "Node.js"]);
    expect(form.softSkills).toEqual(["Comunicação"]);
  });

  it("lista exatamente o que mudou", () => {
    expect(filled.sort()).toEqual(["experiences", "headline", "languages", "phone", "softSkills", "technologies"]);
  });

  it("não altera o formulário de entrada", () => {
    const original = baseForm();
    mergeDraft(original, draft);
    expect(original).toEqual(baseForm());
  });
});

describe("toPayload", () => {
  it("descarta linhas em branco e converte vazio em null", () => {
    const payload = toPayload({
      ...baseForm(),
      state: "sp",
      summary: "  ",
      experiences: [
        emptyExperience(),
        { company: "Acme", role: "Dev", startDate: "2021-03", endDate: "2022-01", isCurrent: true, description: "" },
      ],
      links: [{ label: "", url: "" }],
    });
    expect(payload.state).toBe("SP");
    expect(payload.summary).toBeNull();
    expect(payload.experiences).toEqual([
      { company: "Acme", role: "Dev", startDate: "2021-03", endDate: null, isCurrent: true, description: null },
    ]);
    expect(payload.links).toEqual([]);
  });
});

describe("formatação de período", () => {
  it("mês/ano e atual", () => {
    expect(formatMonth("2021-03")).toBe("mar/2021");
    expect(formatPeriod("2021-03", null, true)).toBe("mar/2021 – atual");
    expect(formatPeriod(null, "2018-01", false)).toBe("jan/2018");
  });
});
