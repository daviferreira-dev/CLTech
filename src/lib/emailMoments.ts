// Momentos do processo seletivo que disparam e-mail ao candidato (spec 008). Cada um tem um
// modelo padrão na biblioteca do RH (EmailTemplate.defaultFor) — inserido pela migration
// 20261031131416_email_templates com o texto abaixo, para nada mudar até o RH editar.
import { STAGE_LABEL, type StageType } from "./processStages";
import { meetingValues } from "./emailTemplate";

export const EMAIL_MOMENTS = [
  "APPLICATION_RECEIVED",
  "STAGE_ADVANCED_RESUME_ANALYSIS",
  "STAGE_ADVANCED_CODE_TEST",
  "STAGE_ADVANCED_GITHUB_ANALYSIS",
  "STAGE_ADVANCED_HR_INTERVIEW",
  "STAGE_ADVANCED_TECH_INTERVIEW",
  "STAGE_ADVANCED_FINAL_OFFER",
  "REJECTED",
  "APPROVED",
  "JOB_CLOSED",
] as const;
export type EmailMoment = (typeof EMAIL_MOMENTS)[number];

/** Momento disparado ao avançar para esta etapa — um por StageType (RF-E3). */
export function stageAdvancedMoment(type: StageType): EmailMoment {
  return `STAGE_ADVANCED_${type}` as EmailMoment;
}

export const EMAIL_MOMENT_LABEL: Record<EmailMoment, string> = {
  APPLICATION_RECEIVED: "Candidatura recebida",
  STAGE_ADVANCED_RESUME_ANALYSIS: `Avançou — ${STAGE_LABEL.RESUME_ANALYSIS}`,
  STAGE_ADVANCED_CODE_TEST: "Teste de código liberado",
  STAGE_ADVANCED_GITHUB_ANALYSIS: `Avançou — ${STAGE_LABEL.GITHUB_ANALYSIS}`,
  STAGE_ADVANCED_HR_INTERVIEW: `Avançou — ${STAGE_LABEL.HR_INTERVIEW}`,
  STAGE_ADVANCED_TECH_INTERVIEW: `Avançou — ${STAGE_LABEL.TECH_INTERVIEW}`,
  STAGE_ADVANCED_FINAL_OFFER: `Avançou — ${STAGE_LABEL.FINAL_OFFER}`,
  REJECTED: "Reprovado",
  APPROVED: "Aprovado / contratado",
  JOB_CLOSED: "Vaga encerrada",
};

/** Momentos que a vaga pode customizar por etapa — os outros (recebida/encerrada) são só o
 * modelo global da biblioteca, por não terem uma etapa ou vaga específica para guardar a
 * escolha (ver JobBuilder). */
export const JOB_CONFIGURABLE_MOMENTS = new Set<EmailMoment>([
  "STAGE_ADVANCED_RESUME_ANALYSIS",
  "STAGE_ADVANCED_CODE_TEST",
  "STAGE_ADVANCED_GITHUB_ANALYSIS",
  "STAGE_ADVANCED_HR_INTERVIEW",
  "STAGE_ADVANCED_TECH_INTERVIEW",
  "STAGE_ADVANCED_FINAL_OFFER",
  "REJECTED",
  "APPROVED",
]);

/** Variáveis aceitas no assunto/corpo de cada momento — chips de ajuda do editor e dados de
 * exemplo da pré-visualização. Variável fora da lista ainda funciona (fillTemplate não valida
 * o conjunto), isto só documenta o que faz sentido em cada um. */
export const EMAIL_MOMENT_VARIABLES: Record<EmailMoment, readonly string[]> = {
  APPLICATION_RECEIVED: ["candidato", "vaga", "empresa", "link_candidatura"],
  STAGE_ADVANCED_RESUME_ANALYSIS: ["candidato", "vaga", "empresa", "etapa", "link"],
  STAGE_ADVANCED_CODE_TEST: ["candidato", "vaga", "empresa", "etapa", "prazo", "link_teste"],
  STAGE_ADVANCED_GITHUB_ANALYSIS: ["candidato", "vaga", "empresa", "etapa", "link"],
  STAGE_ADVANCED_HR_INTERVIEW: ["candidato", "vaga", "empresa", "etapa", "data", "horario", "link"],
  STAGE_ADVANCED_TECH_INTERVIEW: ["candidato", "vaga", "empresa", "etapa", "data", "horario", "link"],
  STAGE_ADVANCED_FINAL_OFFER: ["candidato", "vaga", "empresa", "etapa", "link"],
  REJECTED: ["candidato", "vaga", "empresa", "etapa", "link"],
  APPROVED: ["candidato", "vaga", "empresa", "link"],
  JOB_CLOSED: ["candidato", "vaga", "empresa", "etapa", "link"],
};

// Dados de exemplo da pré-visualização (telas de modelos e da vaga): a reunião é amanhã às
// 14h (Brasília). Fixo no dia, não na hora exata, para o texto não mudar a cada render.
const PREVIEW_MEETING = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1, 17));

/** Valores de exemplo para pré-visualizar um modelo — `stageLabel`/`jobTitle`/`company` vêm
 * da tela (etapa/vaga reais quando houver, texto genérico na biblioteca). */
export function sampleEmailValues(stageLabel: string, jobTitle: string, company: string): Record<string, string> {
  return {
    candidato: "Maria Silva",
    vaga: jobTitle || "Vaga",
    empresa: company || "Empresa",
    etapa: stageLabel,
    ...meetingValues(PREVIEW_MEETING),
    link: "https://meet.google.com/abc-defg-hij",
    prazo: "60 minutos",
    link_teste: "https://cltech.exemplo/desafios",
    link_candidatura: "https://cltech.exemplo/candidaturas",
  };
}

/**
 * Texto padrão de cada momento — a migration insere exatamente este conteúdo na tabela
 * EmailTemplate (defaultFor), e tests/integration/setup.ts o reinsere a cada teste. Reproduz
 * o e-mail atual onde já existia (avançou/reprovado/vaga preenchida); os três momentos novos
 * (candidatura recebida, teste liberado com prazo/link, vaga encerrada) ganham texto no
 * mesmo tom, já que não existia e-mail algum para eles antes desta feature.
 */
export const DEFAULT_EMAIL_TEMPLATES: Record<EmailMoment, { name: string; subject: string; body: string }> = {
  APPLICATION_RECEIVED: {
    name: "Candidatura recebida",
    subject: "Recebemos sua candidatura — {{vaga}}",
    body: "Recebemos sua candidatura para a vaga {{vaga}} na {{empresa}}. Nossa equipe vai analisar e avisamos por aqui sobre os próximos passos.",
  },
  STAGE_ADVANCED_RESUME_ANALYSIS: {
    name: "Avançou — Análise de Currículo",
    subject: "Você avançou para {{etapa}} — {{vaga}}",
    body: "Você passou para a próxima etapa do processo seletivo da vaga {{vaga}}.",
  },
  STAGE_ADVANCED_CODE_TEST: {
    name: "Teste de código liberado",
    subject: "Você avançou para {{etapa}} — {{vaga}}",
    body:
      "Seu teste de código para a vaga {{vaga}} já está liberado. Você tem até {{prazo}} para concluir, em uma tentativa única — reserve um tempo tranquilo antes de começar.\nAcesse por aqui: {{link_teste}}",
  },
  STAGE_ADVANCED_GITHUB_ANALYSIS: {
    name: "Avançou — Análise de GitHub",
    subject: "Você avançou para {{etapa}} — {{vaga}}",
    body: "Você passou para a próxima etapa do processo seletivo da vaga {{vaga}}.",
  },
  STAGE_ADVANCED_HR_INTERVIEW: {
    name: "Avançou — Entrevista de RH",
    subject: "Você avançou para {{etapa}} — {{vaga}}",
    body: "Você passou para a próxima etapa do processo seletivo da vaga {{vaga}}.",
  },
  STAGE_ADVANCED_TECH_INTERVIEW: {
    name: "Avançou — Entrevista Técnica",
    subject: "Você avançou para {{etapa}} — {{vaga}}",
    body: "Você passou para a próxima etapa do processo seletivo da vaga {{vaga}}.",
  },
  STAGE_ADVANCED_FINAL_OFFER: {
    name: "Avançou — Proposta Final",
    subject: "Você avançou para {{etapa}} — {{vaga}}",
    body: "Você passou para a próxima etapa do processo seletivo da vaga {{vaga}}.",
  },
  REJECTED: {
    name: "Reprovado",
    subject: "Atualização sobre sua candidatura — {{vaga}}",
    body:
      "Obrigado por participar do processo seletivo da vaga {{vaga}}. Depois de uma análise cuidadosa, decidimos não seguir com a sua candidatura neste momento.",
  },
  APPROVED: {
    name: "Aprovado / contratado",
    subject: "Você foi aprovado(a) na vaga {{vaga}}! 🎉",
    body: "Você foi aprovado(a) no processo seletivo da vaga {{vaga}}. Foi uma jornada e tanto — obrigado por cada etapa.",
  },
  JOB_CLOSED: {
    name: "Vaga encerrada",
    subject: "Atualização sobre sua candidatura — {{vaga}}",
    body: "Obrigado por participar do processo seletivo da vaga {{vaga}}. Ela foi encerrada, e por isso sua candidatura também foi encerrada.",
  },
};
