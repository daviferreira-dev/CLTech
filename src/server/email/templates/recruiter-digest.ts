// Spec 010 FR-1005 / US3: resumo diário ao recrutador com quem está parado esperando por ele,
// agrupado por vaga, com link para cada relatório. Mesmo layout dos outros e-mails.
// Vai só para o recrutador, que já vê esses nomes no painel; nada de score, currículo ou contato.
import type { MailMessage } from "../mailer";
import { COLOR, FONT, escapeHtml, firstName, joinUrl, renderEmailLayout, stageLabel } from "./layout";

export interface RecruiterDigestJob {
  jobId: string;
  jobTitle: string;
  candidates: Array<{ applicationId: string; candidateName: string; stageType: string; days: number }>;
}

export interface RecruiterDigestEmailInput {
  to: string;
  recruiterName: string;
  stalledDays: number;
  jobs: RecruiterDigestJob[];
  appUrl: string;
}

function dayCount(days: number): string {
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function reportUrl(appUrl: string, jobId: string, applicationId: string): string {
  return joinUrl(appUrl, `/recrutamento/vagas/${jobId}/candidaturas/${applicationId}`);
}

export function recruiterDigestSubject(total: number): string {
  return total === 1 ? "1 candidato aguardando você" : `${total} candidatos aguardando você`;
}

export function recruiterDigestEmail(input: RecruiterDigestEmailInput): MailMessage {
  const total = input.jobs.reduce((sum, job) => sum + job.candidates.length, 0);
  const subject = recruiterDigestSubject(total);
  const vagas = input.jobs.length === 1 ? "1 vaga" : `${input.jobs.length} vagas`;
  const limit = `há mais de ${dayCount(input.stalledDays)} na mesma etapa`;
  const dashboardUrl = joinUrl(input.appUrl, "/recrutamento");

  const section = input.jobs
    .map((job) => {
      const rows = job.candidates
        .map(
          (c) => `<tr>
            <td style="padding:8px 0;border-top:1px solid ${COLOR.border};font-family:${FONT};font-size:14px;line-height:20px;">
              <a href="${escapeHtml(reportUrl(input.appUrl, job.jobId, c.applicationId))}" style="color:${COLOR.ink};font-weight:600;text-decoration:underline;">${escapeHtml(c.candidateName)}</a>
              <div style="color:${COLOR.inkSoft};">${escapeHtml(stageLabel(c.stageType))}</div>
            </td>
            <td align="right" valign="top" style="padding:8px 0 8px 12px;border-top:1px solid ${COLOR.border};font-family:${FONT};font-size:14px;font-weight:700;color:${COLOR.ink};white-space:nowrap;">há ${dayCount(c.days)}</td>
          </tr>`,
        )
        .join("");
      return `<div style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.6px;color:${COLOR.inkMuted};margin-bottom:4px;">${escapeHtml(job.jobTitle.toUpperCase())}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
      </div>`;
    })
    .join("");

  const html = renderEmailLayout({
    subject,
    preheader: `${subject} em ${vagas}.`,
    headline: `Olá, ${firstName(input.recruiterName)}!`,
    intro: escapeHtml(`Estes candidatos estão ${limit} e a próxima decisão é sua.`),
    highlight: { tone: "neutral", eyebrow: "CANDIDATOS PARADOS", title: subject, text: `Em ${vagas}. O mais antigo aparece primeiro.` },
    section,
    cta: { label: "Abrir o painel", href: dashboardUrl },
    footer: "Você recebe este resumo porque tem vagas publicadas na CLTech. Ele só chega quando há alguém parado.",
  });

  const text = [
    `Olá, ${firstName(input.recruiterName)}!`,
    "",
    `Estes candidatos estão ${limit} e a próxima decisão é sua.`,
    "",
    ...input.jobs.flatMap((job) => [
      `${job.jobTitle}:`,
      ...job.candidates.map((c) => `  - ${c.candidateName} · ${stageLabel(c.stageType)} · há ${dayCount(c.days)}: ${reportUrl(input.appUrl, job.jobId, c.applicationId)}`),
      "",
    ]),
    `Abrir o painel: ${dashboardUrl}`,
    "",
    "— CLTech",
  ].join("\n");

  return { to: input.to, subject, html, text };
}
