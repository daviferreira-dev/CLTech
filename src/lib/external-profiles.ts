// Normaliza o que o candidato digita ao conectar uma conta externa (FR-010): aceita o
// link completo do perfil ou só o usuário, e devolve o identificador + a URL canônica.
// Puro — usado no servidor (validação) e na tela (prévia/erro antes do envio).

export interface ParsedExternalProfile {
  username: string;
  url: string;
}

// Regras de login do GitHub: 1–39 caracteres, alfanumérico ou hífen, sem hífen nas pontas
// nem duplo.
const GITHUB_USERNAME = /^(?!-)(?!.*--)[a-z0-9-]{1,39}(?<!-)$/i;
// Rotas do github.com que não são perfis de usuário.
const GITHUB_RESERVED = new Set(["orgs", "settings", "login", "about", "features", "topics", "explore", "marketplace"]);

// Slug público do LinkedIn (linkedin.com/in/<slug>): 3–100 caracteres, letras (inclusive
// acentuadas, que o LinkedIn permite), dígitos e hífen.
const LINKEDIN_SLUG = /^[\p{L}\p{N}-]{3,100}$/u;

function stripUrl(input: string, host: RegExp): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/[./]/.test(trimmed)) return trimmed.replace(/^@/, "");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!host.test(url.hostname)) return null;
  return url.pathname;
}

export function parseGithubProfile(input: string): ParsedExternalProfile | null {
  const stripped = stripUrl(input, /^(www\.)?github\.com$/i);
  if (stripped === null) return null;
  const username = stripped.split("/").filter(Boolean)[0] ?? "";
  if (!GITHUB_USERNAME.test(username) || GITHUB_RESERVED.has(username.toLowerCase())) return null;
  return { username, url: `https://github.com/${username}` };
}

export function parseLinkedinProfile(input: string): ParsedExternalProfile | null {
  const stripped = stripUrl(input, /^([a-z]{2,3}\.)?linkedin\.com$/i);
  if (stripped === null) return null;
  let slug: string;
  if (stripped.startsWith("/")) {
    const [section, value] = stripped.split("/").filter(Boolean);
    if (section !== "in" || !value) return null;
    slug = value;
  } else {
    slug = stripped;
  }
  try {
    slug = decodeURIComponent(slug);
  } catch {
    return null;
  }
  if (!LINKEDIN_SLUG.test(slug)) return null;
  return { username: slug, url: `https://www.linkedin.com/in/${encodeURIComponent(slug)}` };
}

export function parseLattesProfile(input: string): ParsedExternalProfile | null {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!/^((www\.)?lattes|buscatextual)\.cnpq\.br$/i.test(url.hostname)) return null;
    const id = url.searchParams.get("id") ?? url.pathname.split("/").filter(Boolean).pop() ?? "";
    if (!id) return null;
    return { username: id, url: url.toString() };
  } catch {
    return null;
  }
}
