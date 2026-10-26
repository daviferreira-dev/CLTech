// E-mail de encerramento da candidatura (RN005: feedback obrigatório também na reprovação).
// Tom acolhedor e sem nota: Princípio I (research.md R11) — nunca score, currículo ou GitHub.
import type { MailMessage } from "../mailer";
import { escapeHtml, firstName, joinUrl, renderEmailLayout, stageLabel } from "./layout";

export interface RejectedEmailInput {
  to: string;
  candidateName: string;
  jobTitle: string;
  /** Etapa em que a candidatura estava quando foi encerrada. */
  stageType: string;
  /** `REJECTED`: decisão do recrutador. `JOB_FILLED`: a vaga foi preenchida por outra pessoa. */
  reason: "REJECTED" | "JOB_FILLED";
  appUrl: string;
}

export function rejectedEmail(input: RejectedEmailInput): MailMessage {
  const name = firstName(input.candidateName);
  const job = escapeHtml(input.jobTitle);
  const stage = stageLabel(input.stageType);
  const filled = input.reason === "JOB_FILLED";
  const ctaHref = joinUrl(input.appUrl, "/vagas");

  const subject = `Atualização sobre sua candidatura — ${input.jobTitle}`;
  const intro = filled
    ? `Obrigado por participar do processo seletivo da vaga <strong>${job}</strong>. A vaga acabou de ser preenchida, e por isso sua candidatura foi encerrada.`
    : `Obrigado por participar do processo seletivo da vaga <strong>${job}</strong>. Depois de uma análise cuidadosa, decidimos não seguir com a sua candidatura neste momento.`;
  const closing = "Essa decisão vale só para esta vaga. Seu perfil continua salvo na CLTech, e você pode se candidatar a outras oportunidades quando quiser.";

  const html = renderEmailLayout({
    subject,
    preheader: "Obrigado por participar. Veja como seguir daqui.",
    headline: `Olá, ${name}`,
    intro,
    highlight: { tone: "neutral", eyebrow: "VOCÊ CHEGOU ATÉ", title: stage, text: closing },
    cta: { label: "Ver outras vagas", href: ctaHref },
  });

  const text = [
    `Olá, ${name}`,
    "",
    filled
      ? `Obrigado por participar do processo seletivo da vaga ${input.jobTitle}. A vaga acabou de ser preenchida, e por isso sua candidatura foi encerrada.`
      : `Obrigado por participar do processo seletivo da vaga ${input.jobTitle}. Depois de uma análise cuidadosa, decidimos não seguir com a sua candidatura neste momento.`,
    "",
    `Você chegou até: ${stage}.`,
    closing,
    "",
    `Ver outras vagas: ${ctaHref}`,
    "",
    "— CLTech",
  ].join("\n");

  return { to: input.to, subject, html, text };
}
