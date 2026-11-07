// E-mail de encerramento da candidatura — reprovação (RN005) ou vaga encerrada com a
// candidatura ainda em andamento (momentos distintos na biblioteca, mesmo layout). Assunto e
// corpo vêm do modelo já resolvido (vaga → biblioteca → padrão — ver resolve.ts/notify.ts).
// Tom acolhedor e sem nota: Princípio I (research.md R11) — nunca score, currículo ou GitHub.
import type { MailMessage } from "../mailer";
import { fillTemplate } from "@/lib/emailTemplate";
import { escapeHtml, firstName, joinUrl, renderEmailLayout, stageLabel } from "./layout";

export interface RejectedEmailInput {
  to: string;
  candidateName: string;
  jobTitle: string;
  company: string;
  /** Etapa em que a candidatura estava quando foi encerrada. */
  stageType: string;
  /** Assunto/corpo já resolvidos para este momento (REJECTED ou JOB_CLOSED). */
  template: { subject: string; body: string };
  appUrl: string;
  /** Spec 009: rótulo do motivo (`{{motivo}}`) e retorno escrito pelo recrutador (`{{retorno}}`). */
  reasonLabel?: string;
  feedback?: string | null;
}

export function rejectedEmail(input: RejectedEmailInput): MailMessage {
  const name = firstName(input.candidateName);
  const stage = stageLabel(input.stageType);
  const ctaHref = joinUrl(input.appUrl, "/vagas");
  const closing = "Essa decisão vale só para esta vaga. Seu perfil continua salvo na CLTech, e você pode se candidatar a outras oportunidades quando quiser.";

  const feedback = input.feedback?.trim() ?? "";
  const values = {
    candidato: input.candidateName,
    vaga: input.jobTitle,
    empresa: input.company,
    etapa: stage,
    link: ctaHref,
    motivo: input.reasonLabel ?? "",
    retorno: feedback,
  };
  const subject = fillTemplate(input.template.subject, values).replace(/[\r\n]+/g, " ").trim() || `Atualização sobre sua candidatura — ${input.jobTitle}`;
  // O recrutador escreveu o retorno para o candidato ler: se o modelo não tem `{{retorno}}`
  // (o padrão não tem), ele vai num bloco próprio no fim, em vez de se perder.
  const feedbackBlock = feedback && !input.template.body.includes("{{retorno}}") ? `\n\nRetorno do recrutador:\n${feedback}` : "";
  const bodyText = (fillTemplate(input.template.body, values).trim() || closing) + feedbackBlock;
  const intro = escapeHtml(bodyText).replace(/\n/g, "<br>");

  const html = renderEmailLayout({
    subject,
    preheader: "Obrigado por participar. Veja como seguir daqui.",
    headline: `Olá, ${name}`,
    intro,
    highlight: { tone: "neutral", eyebrow: "VOCÊ CHEGOU ATÉ", title: stage, text: closing },
    cta: { label: "Ver outras vagas", href: ctaHref },
  });

  const text = [`Olá, ${name}`, "", bodyText, "", `Você chegou até: ${stage}.`, closing, "", `Ver outras vagas: ${ctaHref}`, "", "— CLTech"].join("\n");

  return { to: input.to, subject, html, text };
}
