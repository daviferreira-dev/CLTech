// Estado do formulário de perfil (spec 007) e as conversões em volta dele: a partir da
// API (`fromProfile`), com o rascunho lido do currículo (`mergeDraft`) e de volta para o
// PATCH (`toPayload`). Tudo puro — testado em tests/unit/profile-form.test.ts.
//
// No formulário tudo é string ("" = vazio); `null` só aparece no payload.

import type {
  EducationLevel,
  LanguageLevel,
  ProfileDetails,
} from "@/lib/profile-details";

export interface ExperienceForm {
  company: string;
  role: string;
  startDate: string; // YYYY-MM ou ""
  endDate: string;
  isCurrent: boolean;
  description: string;
}

export interface EducationForm {
  institution: string;
  course: string;
  level: EducationLevel | "";
  startDate: string;
  endDate: string;
  inProgress: boolean;
}

export interface LanguageForm {
  name: string;
  level: LanguageLevel | "";
}

export interface LinkForm {
  label: string;
  url: string;
}

export interface ProfileFormState {
  name: string;
  phone: string;
  city: string;
  state: string;
  headline: string;
  summary: string;
  technologies: string[];
  softSkills: string[];
  experiences: ExperienceForm[];
  educations: EducationForm[];
  languages: LanguageForm[];
  links: LinkForm[];
}

const SCALAR_DRAFT_FIELDS = ["phone", "city", "state", "headline", "summary"] as const;
const LIST_DRAFT_FIELDS = ["experiences", "educations", "languages", "links"] as const;
const TAG_DRAFT_FIELDS = ["technologies", "softSkills"] as const;

export type DraftField =
  | (typeof SCALAR_DRAFT_FIELDS)[number]
  | (typeof LIST_DRAFT_FIELDS)[number]
  | (typeof TAG_DRAFT_FIELDS)[number];

/** O que o currículo conseguiu ler, já no formato do formulário (FR-706/707). */
export type ProfileDraft = Partial<Pick<ProfileFormState, (typeof SCALAR_DRAFT_FIELDS)[number]>> &
  Pick<ProfileFormState, (typeof LIST_DRAFT_FIELDS)[number] | (typeof TAG_DRAFT_FIELDS)[number]>;

export const emptyExperience = (): ExperienceForm => ({
  company: "",
  role: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  description: "",
});
export const emptyEducation = (): EducationForm => ({
  institution: "",
  course: "",
  level: "",
  startDate: "",
  endDate: "",
  inProgress: false,
});
export const emptyLanguage = (): LanguageForm => ({ name: "", level: "" });
export const emptyLink = (): LinkForm => ({ label: "", url: "" });

export function fromProfile(profile: {
  name: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  details: ProfileDetails;
}): ProfileFormState {
  const d = profile.details;
  return {
    name: profile.name,
    phone: profile.phone ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    headline: d.headline ?? "",
    summary: d.summary ?? "",
    technologies: [...d.technologies],
    softSkills: [...d.softSkills],
    experiences: d.experiences.map((e) => ({
      company: e.company,
      role: e.role,
      startDate: e.startDate,
      endDate: e.endDate ?? "",
      isCurrent: e.isCurrent,
      description: e.description ?? "",
    })),
    educations: d.educations.map((e) => ({
      institution: e.institution,
      course: e.course,
      level: e.level,
      startDate: e.startDate ?? "",
      endDate: e.endDate ?? "",
      inProgress: e.inProgress,
    })),
    languages: d.languages.map((l) => ({ ...l })),
    links: d.links.map((l) => ({ ...l })),
  };
}

/** Une listas de tags sem duplicar (comparação sem caixa). */
export function unionTags(current: string[], extra: string[]): string[] {
  const seen = new Set(current.map((t) => t.toLowerCase()));
  const result = [...current];
  for (const tag of extra) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(tag);
    }
  }
  return result;
}

/**
 * Aplica o rascunho do currículo só no que está vazio (spec 007, decisão P2): campo
 * preenchido fica como está, lista só é preenchida se estiver vazia, tags são unidas.
 * `filled` lista o que mudou, para a tela marcar com o selo "do currículo".
 */
export function mergeDraft(form: ProfileFormState, draft: ProfileDraft): { form: ProfileFormState; filled: DraftField[] } {
  const next: ProfileFormState = { ...form };
  const filled: DraftField[] = [];

  for (const field of SCALAR_DRAFT_FIELDS) {
    const value = draft[field]?.trim();
    if (value && !form[field].trim()) {
      next[field] = value;
      filled.push(field);
    }
  }

  if (draft.experiences.length > 0 && form.experiences.length === 0) {
    next.experiences = draft.experiences.map((e) => ({ ...e }));
    filled.push("experiences");
  }
  if (draft.educations.length > 0 && form.educations.length === 0) {
    next.educations = draft.educations.map((e) => ({ ...e }));
    filled.push("educations");
  }
  if (draft.languages.length > 0 && form.languages.length === 0) {
    next.languages = draft.languages.map((l) => ({ ...l }));
    filled.push("languages");
  }
  if (draft.links.length > 0 && form.links.length === 0) {
    next.links = draft.links.map((l) => ({ ...l }));
    filled.push("links");
  }

  for (const field of TAG_DRAFT_FIELDS) {
    const merged = unionTags(form[field], draft[field]);
    if (merged.length > form[field].length) {
      next[field] = merged;
      filled.push(field);
    }
  }

  return { form: next, filled };
}

const orNull = (value: string) => (value.trim() ? value.trim() : null);
const isBlank = (...values: string[]) => values.every((v) => !v.trim());

/**
 * Corpo do PATCH /api/me/profile. Linhas adicionadas e deixadas em branco são descartadas
 * (não viram erro de validação); o resto vai como está e o servidor valida (FR-704).
 */
export function toPayload(form: ProfileFormState) {
  return {
    name: form.name,
    phone: form.phone,
    city: form.city,
    state: form.state.toUpperCase(),
    headline: orNull(form.headline),
    summary: orNull(form.summary),
    technologies: form.technologies,
    softSkills: form.softSkills,
    experiences: form.experiences
      .filter((e) => !isBlank(e.company, e.role, e.startDate, e.endDate, e.description))
      .map((e) => ({
        company: e.company.trim(),
        role: e.role.trim(),
        startDate: e.startDate,
        endDate: e.isCurrent ? null : orNull(e.endDate),
        isCurrent: e.isCurrent,
        description: orNull(e.description),
      })),
    educations: form.educations
      .filter((e) => !isBlank(e.institution, e.course, e.startDate, e.endDate))
      .map((e) => ({
        institution: e.institution.trim(),
        course: e.course.trim(),
        level: e.level,
        startDate: orNull(e.startDate),
        endDate: orNull(e.endDate),
        inProgress: e.inProgress,
      })),
    languages: form.languages.filter((l) => !isBlank(l.name)).map((l) => ({ name: l.name.trim(), level: l.level })),
    links: form.links.filter((l) => !isBlank(l.label, l.url)).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
  };
}
