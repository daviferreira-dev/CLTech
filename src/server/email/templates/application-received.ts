// E-mail de confirmação da candidatura — nova nesta feature (apply.ts nunca avisou o
// candidato antes). Assunto e corpo vêm do modelo já resolvido (biblioteca → padrão; este
// momento não tem configuração por vaga — ver resolve.ts/notify.ts).
import type { MailMessage } from "../mailer";
import { fillTemplate } from "@/lib/emailTemplate";
import { escapeHtml, firstName, joinUrl, renderEmailLayout } from "./layout";

export interface ApplicationReceivedEmailInput {
  to: string;
  candidateName: string;
  jobTitle: string;
  company: string;
  template: { subject: string; body: string };
  appUrl: string;
}

export function applicationReceivedEmail(input: ApplicationReceivedEmailInput): MailMessage {
  const name = firstName(input.candidateName);
  const ctaHref = joinUrl(input.appUrl, "/candidaturas");
  const closing = "Acompanhe o andamento a qualquer momento pela sua lista de candidaturas.";

  const values = { candidato: input.candidateName, vaga: input.jobTitle, empresa: input.company, link_candidatura: ctaHref };
  const subject = fillTemplate(input.template.subject, values).replace(/[\r\n]+/g, " ").trim() || `Recebemos sua candidatura — ${input.jobTitle}`;
  const bodyText = fillTemplate(input.template.body, values).trim() || closing;
  const intro = escapeHtml(bodyText).replace(/\n/g, "<br>");

  const html = renderEmailLayout({
    subject,
    preheader: "Sua candidatura foi recebida. Veja como acompanhar.",
    headline: `Olá, ${name}`,
    intro,
    highlight: { tone: "neutral", eyebrow: "CANDIDATURA", title: "Recebida", text: closing },
    cta: { label: "Acompanhar candidatura", href: ctaHref },
  });

  const text = [`Olá, ${name}`, "", bodyText, "", closing, "", `Acompanhar candidatura: ${ctaHref}`, "", "— CLTech"].join("\n");

  return { to: input.to, subject, html, text };
}
