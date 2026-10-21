// Leitura estruturada do currículo (spec 007, FR-707) — regras determinísticas, sem LLM
// (D11). Recebe o texto já extraído (text-extract.ts) e devolve um rascunho no formato do
// formulário. Nunca lança e nunca grava: o candidato revisa e salva (decisão P2).
//
// Contato, links e tecnologias saem confiáveis. Experiências e formação dependem do
// layout do currículo e saem aproximadas — por isso só preenchem lista vazia na tela.

import type { EducationLevel, LanguageLevel } from "@/lib/profile-details";
import { PROFILE_LIMITS } from "@/lib/profile-details";
import type { EducationForm, ExperienceForm, LanguageForm, LinkForm, ProfileDraft } from "@/lib/profile-form";
import { TECH_CATALOG, type CatalogTechnology } from "@/server/candidates/tech-catalog";

type Section = "header" | "summary" | "experience" | "education" | "languages" | "skills" | "technologies" | "other";

/** Títulos de seção, comparados sem acento, sem caixa e sem pontuação. */
const HEADINGS: Record<string, Section> = {};
const heading = (section: Section, ...titles: string[]) => titles.forEach((t) => (HEADINGS[t] = section));
heading("summary", "resumo", "resumo profissional", "sobre", "sobre mim", "perfil", "perfil profissional", "objetivo", "objetivo profissional", "objetivos", "apresentacao", "summary", "about", "about me", "profile");
heading("experience", "experiencia", "experiencias", "experiencia profissional", "experiencias profissionais", "historico profissional", "carreira", "experience", "work experience", "professional experience", "employment");
heading("education", "formacao", "formacao academica", "formacoes", "educacao", "escolaridade", "education", "academic background");
heading("languages", "idiomas", "idioma", "linguas", "languages");
heading("skills", "habilidades", "competencias", "competencias comportamentais", "habilidades comportamentais", "soft skills", "skills", "qualificacoes");
heading("technologies", "tecnologias", "conhecimentos", "conhecimentos tecnicos", "habilidades tecnicas", "competencias tecnicas", "stack", "ferramentas", "hard skills", "technical skills", "tech stack");
heading("other", "projetos", "projetos pessoais", "certificacoes", "certificados", "cursos", "cursos complementares", "premios", "voluntariado", "referencias", "informacoes adicionais", "contato", "dados pessoais", "interesses", "publicacoes", "atividades complementares", "projects", "certifications", "awards");

const UFS = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO";

const ROLE_KEYWORDS =
  /desenvolvedor|developer|engenheir|engineer|analista|analyst|programador|arquitet|architect|designer|cientista|scientist|tech lead|lider tecnico|estagiari|intern\b|gerente|manager|consultor|consultant|especialista|specialist|full ?stack|front-?end|back-?end|devops|\bsre\b|\bqa\b|tester|product owner|scrum master|coordenador|tecnico em|suporte|administrador de|dba\b/;

const INSTITUTION_KEYWORDS =
  /universidade|faculdade|instituto|escola|centro universitario|college|university|school|\bfatec\b|\betec\b|senai|senac|\bpuc\b|\busp\b|unicamp|unesp|\bfgv\b|\bfiap\b|mackenzie|ibmec|insper|uninove|estacio|anhanguera|\bunip\b|\buf[a-z]{1,4}\b|\bif[a-z]{1,4}\b/;

const COURSE_KEYWORDS =
  /bacharel|graduacao|licenciatura|tecnologo|tecnico|\bpos\b|\bmba\b|especializacao|mestrado|doutorado|\bcurso\b|engenharia|ciencia|sistemas|analise e desenvolvimento|administracao|direito|computacao|tecnologia|bootcamp|certifica|bachelor|master|degree/;

const LANGUAGE_NAMES: Record<string, string> = {
  portugues: "Português", portuguese: "Português",
  ingles: "Inglês", english: "Inglês",
  espanhol: "Espanhol", spanish: "Espanhol",
  frances: "Francês", french: "Francês",
  alemao: "Alemão", german: "Alemão",
  italiano: "Italiano", italian: "Italiano",
  japones: "Japonês", japanese: "Japonês",
  mandarim: "Mandarim", chines: "Mandarim", chinese: "Mandarim",
  russo: "Russo", russian: "Russo",
  coreano: "Coreano", korean: "Coreano",
  libras: "Libras",
};

const LANGUAGE_LEVEL_RULES: Array<[RegExp, LanguageLevel]> = [
  [/nativ|materna|native/, "NATIVO"],
  [/fluent/, "FLUENTE"],
  [/avancad|advanced|\bc1\b|\bc2\b|proficien/, "AVANCADO"],
  [/intermediari|intermediate|\bb1\b|\bb2\b/, "INTERMEDIARIO"],
  [/basic|iniciante|beginner|elementar|\ba1\b|\ba2\b/, "BASICO"],
];

const MONTH_PREFIX: Record<string, string> = {
  jan: "01", fev: "02", feb: "02", mar: "03", abr: "04", apr: "04", mai: "05", may: "05",
  jun: "06", jul: "07", ago: "08", aug: "08", set: "09", sep: "09", out: "10", oct: "10",
  nov: "11", dez: "12", dec: "12",
};

const MONTH_WORD =
  "(?:jan(?:eiro)?|january|fev(?:ereiro)?|feb(?:ruary)?|mar(?:ço|co)?|march|abr(?:il)?|apr(?:il)?|mai(?:o)?|may|jun(?:ho)?|june|jul(?:ho)?|july|ago(?:sto)?|aug(?:ust)?|set(?:embro)?|sep(?:t(?:ember)?)?|out(?:ubro)?|oct(?:ober)?|nov(?:embro)?|november|dez(?:embro)?|dec(?:ember)?)";
const YEAR = "(?<![\\d/])(?:19|20)\\d{2}(?!\\d)";
const DATE = `(?:(?<!\\p{L})${MONTH_WORD}\\.?\\s*(?:de\\s+|/\\s*)?(?:19|20)\\d{2}(?!\\d)|(?<!\\d)\\d{1,2}/(?:19|20)\\d{2}(?!\\d)|${YEAR})`;
const CURRENT = "(?:atual(?:mente)?|presente|o momento|hoje|current(?:ly)?|present|now)";
const RANGE = new RegExp(`(${DATE})\\s*(?:-|–|—|\\ba\\b|até|ate|to)\\s*(${DATE}|${CURRENT})`, "iu");
const SINGLE_YEAR = new RegExp(YEAR, "g");
const IS_CURRENT = new RegExp(`^${CURRENT}$`, "i");

/** Separadores entre cargo/empresa ou curso/instituição numa mesma linha. */
const PART_SEPARATOR = /\s+[-–—|]\s+|\s*[|@]\s*|\s+at\s+|\s*,\s+(?=\p{Lu})/u;
const BULLET = /^[-•*▪◦·>]\s*/;

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trim() : value;
}

function toLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim());
}

function sectionOf(line: string): Section | null {
  if (!line || line.length > 45) return null;
  const key = fold(line).replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  return HEADINGS[key] ?? null;
}

function splitSections(lines: string[]): Record<Section, string[]> {
  const sections: Record<Section, string[]> = {
    header: [], summary: [], experience: [], education: [], languages: [], skills: [], technologies: [], other: [],
  };
  let current: Section = "header";
  for (const line of lines) {
    const next = sectionOf(line);
    if (next) current = next;
    else sections[current].push(line);
  }
  return sections;
}

/** "03/2021", "mar 2021", "Março de 2017", "2015" → "YYYY-MM"; ano sozinho vira janeiro. */
function parseMonth(value: string): string | null {
  const folded = fold(value);
  const year = /(19|20)\d{2}/.exec(folded)?.[0];
  if (!year) return null;
  const numeric = /(\d{1,2})\/(19|20)\d{2}/.exec(folded);
  if (numeric) {
    const month = Number(numeric[1]);
    return month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, "0")}` : `${year}-01`;
  }
  const word = /[a-z]{3}/.exec(folded)?.[0];
  return `${year}-${(word && MONTH_PREFIX[word]) ?? "01"}`;
}

function parseRange(line: string): { start: string; end: string; current: boolean; rest: string } | null {
  const match = RANGE.exec(line);
  if (!match) return null;
  const start = parseMonth(match[1] ?? "");
  if (!start) return null;
  const current = IS_CURRENT.test((match[2] ?? "").trim());
  const end = current ? "" : (parseMonth(match[2] ?? "") ?? "");
  const rest = (line.slice(0, match.index) + " " + line.slice(match.index + match[0].length)).trim();
  return { start, end, current, rest };
}

function cleanPart(value: string): string {
  return value.replace(/^[\s|,;:()–—-]+|[\s|,;:()–—-]+$/g, "").trim();
}

function splitParts(line: string): string[] {
  return line.split(PART_SEPARATOR).map(cleanPart).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

function findPhone(text: string): string | undefined {
  const patterns = [
    /\((\d{2})\)\s?(9?\d{4})[\s.-]?(\d{4})(?!\d)/,
    /\+55[\s-]?(\d{2})[\s-]?(9?\d{4})[\s.-]?(\d{4})(?!\d)/,
    /(?<!\d)(\d{2})[\s-](9\d{4})-(\d{4})(?!\d)/,
  ];
  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m) return `(${m[1]}) ${m[2]}-${m[3]}`;
  }
  return undefined;
}

function findCityState(lines: string[]): { city: string; state: string } | undefined {
  const pattern = new RegExp(
    `(\\p{Lu}[\\p{L}'.]*(?: (?:d[aeo]s?|\\p{Lu}[\\p{L}'.]*))*)\\s*[-–/,]\\s*(${UFS})(?![\\p{L}])`,
    "u",
  );
  for (const line of lines.slice(0, 15)) {
    const m = pattern.exec(line);
    if (m?.[1] && m[2] && m[1].length <= 40) return { city: m[1], state: m[2] };
  }
  return undefined;
}

function findHeadline(headerLines: string[]): string | undefined {
  const candidates = headerLines.filter(Boolean).slice(0, 6);
  for (const line of candidates) {
    if (line.length > 80 || /@|https?:|\d{4}/.test(line)) continue;
    if (ROLE_KEYWORDS.test(fold(line))) return clip(line, PROFILE_LIMITS.headline);
  }
  return undefined;
}

const KNOWN_LINK_HOSTS = "github\\.com|gitlab\\.com|linkedin\\.com|lattes\\.cnpq\\.br|behance\\.net|dribbble\\.com|medium\\.com";

function linkLabel(url: string): string {
  const host = fold(url);
  if (host.includes("github.com")) return "GitHub";
  if (host.includes("linkedin.com")) return "LinkedIn";
  if (host.includes("lattes.cnpq.br")) return "Lattes";
  if (host.includes("gitlab.com")) return "GitLab";
  if (host.includes("behance.net")) return "Behance";
  if (host.includes("dribbble.com")) return "Dribbble";
  if (host.includes("medium.com")) return "Medium";
  return "Portfólio";
}

function findLinks(text: string): LinkForm[] {
  const found: Array<{ index: number; raw: string }> = [];
  for (const m of text.matchAll(/https?:\/\/[^\s|,;<>()"']+/gi)) found.push({ index: m.index ?? 0, raw: m[0] });
  const bare = new RegExp(`(?<![@\\w./])(?:www\\.)?(?:${KNOWN_LINK_HOSTS})/[^\\s|,;<>()"']+`, "gi");
  for (const m of text.matchAll(bare)) found.push({ index: m.index ?? 0, raw: m[0] });

  const seen = new Set<string>();
  const links: LinkForm[] = [];
  for (const { raw } of found.sort((a, b) => a.index - b.index)) {
    const trimmed = raw.replace(/[.)\]]+$/, "");
    const url = trimmed.replace(/^http:\/\//i, "https://").replace(/^(?!https:\/\/)/i, "https://");
    const key = url.toLowerCase();
    if (seen.has(key) || url.length > PROFILE_LIMITS.linkUrl) continue;
    seen.add(key);
    links.push({ label: linkLabel(url), url });
  }
  return links.slice(0, PROFILE_LIMITS.listItems);
}

function technologyPattern(term: string, caseSensitive?: boolean): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Palavra inteira, como no score.ts ("Java" não casa "JavaScript"), e sem ponto antes:
  // o alias "JS" não pode casar dentro de "Node.js".
  return new RegExp(`(?<![\\w.])${escaped}(?![\\w])`, caseSensitive ? "" : "i");
}

function findTechnologies(text: string, catalog: CatalogTechnology[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const tech of catalog) {
    const key = tech.name.toLowerCase();
    if (seen.has(key)) continue;
    const terms = [tech.name, ...(tech.aliases ?? [])];
    if (terms.some((term) => technologyPattern(term, tech.caseSensitive).test(text))) {
      seen.add(key);
      found.push(tech.name);
    }
  }
  return found;
}

function splitItems(lines: string[]): string[] {
  return lines
    .flatMap((line) => {
      const body = line.includes(":") ? line.slice(line.indexOf(":") + 1) : line;
      return body.split(/[,;•·|]|\s-\s/);
    })
    .map((item) => item.replace(BULLET, "").replace(/\.$/, "").trim())
    .filter((item) => item.length >= 2 && item.length <= PROFILE_LIMITS.tagLength);
}

function isTechnology(item: string, catalog: CatalogTechnology[]): boolean {
  const key = item.toLowerCase();
  return catalog.some((t) => t.name.toLowerCase() === key || t.aliases?.some((a) => a.toLowerCase() === key));
}

function languageIn(chunk: string): string | undefined {
  for (const word of fold(chunk).split(/[^a-z]+/)) {
    if (LANGUAGE_NAMES[word]) return LANGUAGE_NAMES[word];
  }
  return undefined;
}

function languageLevelIn(chunk: string): LanguageLevel | undefined {
  const folded = fold(chunk);
  return LANGUAGE_LEVEL_RULES.find(([rule]) => rule.test(folded))?.[1];
}

function findLanguages(sectionLines: string[], allLines: string[]): LanguageForm[] {
  const result: LanguageForm[] = [];
  const seen = new Set<string>();
  const add = (name: string, level: LanguageLevel | "") => {
    if (seen.has(name)) return;
    seen.add(name);
    result.push({ name, level });
  };
  const chunks = (lines: string[]) => lines.flatMap((line) => line.split(/[,;|]/));

  for (const chunk of chunks(sectionLines)) {
    const name = languageIn(chunk);
    if (name) add(name, languageLevelIn(chunk) ?? "");
  }
  // Fora da seção, só com nível explícito na mesma frase ("Inglês avançado").
  for (const chunk of chunks(allLines)) {
    const name = languageIn(chunk);
    const level = languageLevelIn(chunk);
    if (name && level) add(name, level);
  }
  return result.slice(0, PROFILE_LIMITS.listItems);
}

/** Frase de descrição, não título: termina em ponto e tem várias palavras ("Gama S.A." não é). */
function isSentence(line: string): boolean {
  return /[.;]$/.test(line) && line.split(" ").length >= 5;
}

function isHeaderLine(line: string): boolean {
  return !!line && line.length <= 90 && !BULLET.test(line) && !isSentence(line);
}

function assignRoleCompany(parts: string[]): { role: string; company: string } {
  const roleIndex = parts.findIndex((p) => ROLE_KEYWORDS.test(fold(p)));
  if (roleIndex >= 0) {
    const company = parts.find((_, i) => i !== roleIndex) ?? "";
    return { role: parts[roleIndex] ?? "", company };
  }
  return { company: parts[0] ?? "", role: parts[1] ?? "" };
}

function findExperiences(lines: string[]): ExperienceForm[] {
  const dated = lines.map((line, index) => ({ index, range: parseRange(line) })).filter((d) => d.range);
  const entries: Array<{ headerStart: number; dateIndex: number; form: Omit<ExperienceForm, "description"> }> = [];

  dated.forEach(({ index, range }, k) => {
    const r = range!;
    const restParts = splitParts(r.rest);
    const previousDate = k > 0 ? (dated[k - 1]?.index ?? -1) : -1;
    const headerLines: string[] = [];
    let headerStart = index;
    const maxBack = restParts.length >= 2 ? 0 : restParts.length === 1 ? 1 : 2;
    for (let j = index - 1; j > previousDate && headerLines.length < maxBack; j--) {
      if (!isHeaderLine(lines[j] ?? "")) break;
      headerLines.unshift(lines[j] ?? "");
      headerStart = j;
    }
    const parts = [...headerLines.flatMap(splitParts), ...restParts];
    const { role, company } = assignRoleCompany(parts);
    entries.push({
      headerStart,
      dateIndex: index,
      form: {
        company: clip(company, PROFILE_LIMITS.company),
        role: clip(role, PROFILE_LIMITS.role),
        startDate: r.start,
        endDate: r.end,
        isCurrent: r.current,
      },
    });
  });

  return entries.slice(0, PROFILE_LIMITS.listItems).map((entry, k) => {
    const end = k + 1 < entries.length ? (entries[k + 1]?.headerStart ?? lines.length) : lines.length;
    const description = lines.slice(entry.dateIndex + 1, end).join("\n").trim();
    return { ...entry.form, description: clip(description, PROFILE_LIMITS.description) };
  });
}

function educationLevel(course: string): EducationLevel | "" {
  const c = fold(course);
  if (/doutorado|phd|doctor/.test(c)) return "DOUTORADO";
  if (/mestrado|master|mestre/.test(c)) return "MESTRADO";
  if (/\bpos\b|\bmba\b|especializacao/.test(c)) return "POS";
  if (/tecnologo|bacharel|licenciatura|graduacao|engenharia|bachelor/.test(c)) return "GRADUACAO";
  if (/tecnico/.test(c)) return "TECNICO";
  if (/\bcurso\b|bootcamp|certifica/.test(c)) return "CURSO_LIVRE";
  return "";
}

function findEducations(lines: string[]): EducationForm[] {
  const result: EducationForm[] = [];
  const blank = (): EducationForm => ({ institution: "", course: "", level: "", startDate: "", endDate: "", inProgress: false });
  let current = blank();
  // Fecha a entrada atual e começa outra: chamado quando chega um campo que ela já tem.
  const flush = () => {
    if (current.institution || current.course) {
      current.level = educationLevel(current.course);
      result.push(current);
    }
    current = blank();
  };

  for (const line of lines) {
    if (!line || BULLET.test(line) || isSentence(line)) continue;
    const range = parseRange(line);
    let text = line;
    let dates: { start: string; end: string; inProgress: boolean } | null = null;
    if (range) {
      dates = { start: range.start, end: range.end, inProgress: range.current };
      text = range.rest;
    } else {
      const years = line.match(SINGLE_YEAR);
      if (years) {
        const ongoing = /cursando|em andamento|em curso|previs|in progress/.test(fold(line));
        dates = years.length >= 2
          ? { start: `${years[0]}-01`, end: `${years[1]}-01`, inProgress: ongoing }
          : { start: "", end: ongoing ? "" : `${years[0]}-01`, inProgress: ongoing };
        text = line.replace(SINGLE_YEAR, " ");
      }
    }

    for (const part of splitParts(text.replace(/cursando|em andamento|conclus[aã]o|previs[aã]o/gi, " "))) {
      const folded = fold(part);
      const isInstitution = INSTITUTION_KEYWORDS.test(folded);
      const isCourse = !isInstitution && COURSE_KEYWORDS.test(folded);
      if (isInstitution || (!isCourse && current.course && !current.institution)) {
        if (current.institution) flush();
        current.institution = clip(part, PROFILE_LIMITS.institution);
      } else if (isCourse || !current.course) {
        if (current.course) flush();
        current.course = clip(part, PROFILE_LIMITS.course);
      }
    }

    if (dates) {
      if (current.startDate || current.endDate) flush();
      current.startDate = dates.start;
      current.endDate = dates.end;
      current.inProgress = dates.inProgress;
    }
  }
  flush();
  return result.slice(0, PROFILE_LIMITS.listItems);
}

// ---------------------------------------------------------------------------

/**
 * Rascunho do perfil a partir do texto do currículo. `extraTechnologies` são as
 * tecnologias das vagas publicadas — casam além do catálogo fixo.
 */
export function parseResume(text: string, extraTechnologies: string[] = []): ProfileDraft {
  const draft: ProfileDraft = {
    technologies: [], softSkills: [], experiences: [], educations: [], languages: [], links: [],
  };
  try {
    if (!text.trim()) return draft;
    const lines = toLines(text);
    const sections = splitSections(lines);
    const catalog = [...TECH_CATALOG, ...extraTechnologies.map((name) => ({ name }))];

    const phone = findPhone(text);
    if (phone) draft.phone = phone;
    const place = findCityState(lines);
    if (place) {
      draft.city = place.city;
      draft.state = place.state;
    }
    const headline = findHeadline(sections.header);
    if (headline) draft.headline = headline;
    const summary = sections.summary.filter(Boolean).join(" ").trim();
    if (summary) draft.summary = clip(summary, PROFILE_LIMITS.summary);

    draft.links = findLinks(text);

    const techItems = splitItems(sections.technologies);
    draft.technologies = [...findTechnologies(text, catalog)];
    for (const item of techItems) {
      if (!draft.technologies.some((t) => t.toLowerCase() === item.toLowerCase())) draft.technologies.push(item);
    }
    draft.technologies = draft.technologies.slice(0, PROFILE_LIMITS.tagCount);

    draft.softSkills = splitItems(sections.skills)
      .filter((item) => !isTechnology(item, catalog) && !languageIn(item))
      .slice(0, PROFILE_LIMITS.tagCount);

    draft.experiences = findExperiences(sections.experience);
    draft.educations = findEducations(sections.education);
    draft.languages = findLanguages(sections.languages, lines);
  } catch {
    // Regra nova que quebre num layout inesperado não pode derrubar o upload.
  }
  return draft;
}
