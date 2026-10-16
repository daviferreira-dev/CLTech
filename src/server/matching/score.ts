// Motor de compatibilidade candidato × vaga (R12) — determinístico, sem LLM (D11).
// Pesos 60% currículo / 40% GitHub; reponderado para 1.0 quando falta um sinal.

export interface GithubLanguageSignal {
  name: string;
  share: number; // 0..1, fração do GithubProfile.languages
}

export interface MatchSignals {
  resumeText: string | null;
  githubLanguages: GithubLanguageSignal[] | null;
}

export interface MatchResult {
  score: number;
  matched: string[];
  missing: string[];
}

const RESUME_WEIGHT = 0.6;
const GITHUB_WEIGHT = 0.4;

/** Casa uma tecnologia da vaga contra o texto por palavra inteira, case-insensitive. */
function matchesResumeText(technology: string, resumeText: string): boolean {
  const escaped = technology.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "i");
  return pattern.test(resumeText);
}

function githubShareFor(technology: string, languages: GithubLanguageSignal[]): number {
  const match = languages.find((lang) => lang.name.toLowerCase() === technology.toLowerCase());
  return match ? match.share : 0;
}

/**
 * Score 0-100 de compatibilidade entre as tecnologias exigidas pela vaga e os sinais
 * disponíveis do candidato. Retorna `null` quando nenhum sinal existe (currículo sem
 * texto extraído e sem GitHub) — a ausência de score é tratada pela interface como
 * "complete seu perfil" (FR-036), nunca como zero.
 */
export function computeScore(jobTechnologies: string[], signals: MatchSignals): MatchResult | null {
  if (jobTechnologies.length === 0) return { score: 0, matched: [], missing: [] };

  const hasResume = !!signals.resumeText;
  const hasGithub = !!signals.githubLanguages && signals.githubLanguages.length > 0;
  if (!hasResume && !hasGithub) return null;

  const matched: string[] = [];
  const missing: string[] = [];
  let resumeHits = 0;
  let githubShareSum = 0;

  for (const technology of jobTechnologies) {
    const inResume = hasResume ? matchesResumeText(technology, signals.resumeText as string) : false;
    const githubShare = hasGithub ? githubShareFor(technology, signals.githubLanguages as GithubLanguageSignal[]) : 0;

    if (inResume) resumeHits += 1;
    githubShareSum += githubShare;

    if (inResume || githubShare > 0) matched.push(technology);
    else missing.push(technology);
  }

  const total = jobTechnologies.length;
  const coberturaCurriculo = hasResume ? resumeHits / total : 0;
  const coberturaGithub = hasGithub ? Math.min(githubShareSum / total, 1) : 0;

  // Reponderação: usa só o peso do sinal disponível, nunca trata a ausência como cobertura zero.
  let score: number;
  if (hasResume && hasGithub) {
    score = RESUME_WEIGHT * coberturaCurriculo + GITHUB_WEIGHT * coberturaGithub;
  } else if (hasResume) {
    score = coberturaCurriculo;
  } else {
    score = coberturaGithub;
  }

  return { score: Math.round(score * 100), matched, missing };
}
