// Rótulos de exibição dos enums do domínio, compartilhados entre telas.
import type { BadgeVariant } from "@/components/ui/Badge";

export const WORK_MODE_LABEL: Record<string, string> = { REMOTE: "Remoto", HYBRID: "Híbrido", ONSITE: "Presencial" };

export const SENIORITY_LABEL: Record<string, string> = {
  INTERN: "Estágio",
  JUNIOR: "Júnior",
  MID: "Pleno",
  SENIOR: "Sênior",
};

export const JOB_STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicada", CLOSED: "Encerrada" };

export const JOB_STATUS_BADGE: Record<string, BadgeVariant> = { DRAFT: "warning", PUBLISHED: "success", CLOSED: "muted" };

/** Visão do candidato: sem linguagem interna de triagem (spec 004 FR-108). */
export const CANDIDATE_APPLICATION_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  APPROVED: "Aprovado",
  REJECTED: "Não aprovado",
  WITHDRAWN: "Retirada",
};

export const RECRUITER_APPLICATION_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  WITHDRAWN: "Desistiu",
};

export const APPLICATION_STATUS_BADGE: Record<string, BadgeVariant> = {
  IN_PROGRESS: "neutral",
  APPROVED: "success",
  REJECTED: "danger",
  WITHDRAWN: "muted",
};

/**
 * Spec 009: motivo da reprovação. Um texto só, neutro o bastante para ir ao candidato quando o
 * RH usa `{{motivo}}` no modelo (o padrão não usa: a categoria é interna, spec 004 FR-108).
 */
export const REJECTION_REASON_LABEL: Record<string, string> = {
  TECHNICAL_SKILLS: "Conhecimentos técnicos abaixo do que a vaga pede",
  CODE_TEST_SCORE: "Resultado do teste de código",
  INTERVIEW_PERFORMANCE: "Desempenho na entrevista",
  REQUIREMENTS_NOT_MET: "Requisitos mínimos da vaga não atendidos",
  NO_RESPONSE: "Não recebemos seu retorno a tempo",
  OTHER: "Outros motivos",
  POSITION_FILLED: "Vagas já preenchidas",
  JOB_CLOSED: "Vaga encerrada",
};

export const PROVIDER_LABEL: Record<string, string> = { GITHUB: "GitHub", LINKEDIN: "LinkedIn", LATTES: "Lattes" };

/** "São Paulo · Híbrido", sem repetir quando a localização já é a modalidade ("Remoto · Remoto"). */
export function jobPlace(location: string, workMode: string): string {
  const mode = WORK_MODE_LABEL[workMode] ?? workMode;
  return location && location.trim().toLowerCase() !== mode.toLowerCase() ? `${location} · ${mode}` : mode;
}
