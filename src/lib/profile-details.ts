// Perfil profissional (spec 007) — tipos e rótulos compartilhados por cliente e servidor.
// Datas são mês/ano no formato `YYYY-MM` (FR-703).

export const EDUCATION_LEVELS = ["TECNICO", "GRADUACAO", "POS", "MESTRADO", "DOUTORADO", "CURSO_LIVRE", "OUTRO"] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const EDUCATION_LEVEL_LABEL: Record<EducationLevel, string> = {
  TECNICO: "Técnico",
  GRADUACAO: "Graduação",
  POS: "Pós-graduação / MBA",
  MESTRADO: "Mestrado",
  DOUTORADO: "Doutorado",
  CURSO_LIVRE: "Curso livre",
  OUTRO: "Outro",
};

export const LANGUAGE_LEVELS = ["BASICO", "INTERMEDIARIO", "AVANCADO", "FLUENTE", "NATIVO"] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export const LANGUAGE_LEVEL_LABEL: Record<LanguageLevel, string> = {
  BASICO: "Básico",
  INTERMEDIARIO: "Intermediário",
  AVANCADO: "Avançado",
  FLUENTE: "Fluente",
  NATIVO: "Nativo",
};

export interface ExperienceDetails {
  company: string;
  role: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
}

export interface EducationDetails {
  institution: string;
  course: string;
  level: EducationLevel;
  startDate: string | null;
  endDate: string | null;
  inProgress: boolean;
}

export interface LanguageDetails {
  name: string;
  level: LanguageLevel;
}

export interface LinkDetails {
  label: string;
  url: string;
}

export interface ProfileDetails {
  headline: string | null;
  summary: string | null;
  technologies: string[];
  softSkills: string[];
  experiences: ExperienceDetails[];
  educations: EducationDetails[];
  languages: LanguageDetails[];
  links: LinkDetails[];
}

export const PROFILE_LIMITS = {
  headline: 120,
  summary: 2000,
  tagCount: 40,
  tagLength: 40,
  listItems: 30,
  company: 120,
  role: 120,
  description: 2000,
  institution: 160,
  course: 160,
  languageName: 60,
  linkLabel: 40,
  linkUrl: 300,
} as const;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2021-03" → "mar/2021". Valor fora do formato volta como veio. */
export function formatMonth(value: string | null): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]}/${match[1]}`;
}

/** "mar/2021 – atual", "2018 – 2022", "" quando não há datas. */
export function formatPeriod(start: string | null, end: string | null, ongoing: boolean): string {
  const from = formatMonth(start);
  const to = ongoing ? "atual" : formatMonth(end);
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

export function isProfileEmpty(details: ProfileDetails): boolean {
  return (
    !details.headline &&
    !details.summary &&
    details.technologies.length === 0 &&
    details.softSkills.length === 0 &&
    details.experiences.length === 0 &&
    details.educations.length === 0 &&
    details.languages.length === 0 &&
    details.links.length === 0
  );
}
