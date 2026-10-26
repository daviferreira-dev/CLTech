// Moldura comum dos e-mails ao candidato. HTML em tabelas com estilo inline: é o que Gmail,
// Outlook e clientes de celular renderizam igual. Cores = tokens de src/app/globals.css.
import { STAGE_LABEL } from "@/lib/processStages";

export const COLOR = {
  brand: "#0F172A",
  accent: "#059669",
  accentSoft: "#D1FAE5",
  canvas: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  neutralSoft: "#F1F5F9",
  ink: "#0F172A",
  inkSoft: "#475569",
  inkMuted: "#94A3B8",
};

export const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export function stageLabel(type: string): string {
  return STAGE_LABEL[type] ?? type;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export function joinUrl(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/$/, "")}${path}`;
}

export interface EmailLayoutInput {
  subject: string;
  /** Texto curto que o cliente de e-mail mostra ao lado do assunto. */
  preheader: string;
  headline: string;
  /** HTML já escapado. */
  intro: string;
  highlight: { tone: "success" | "neutral"; eyebrow: string; title: string; text: string };
  /** HTML extra entre o destaque e o botão (já escapado). */
  section?: string;
  cta: { label: string; href: string };
}

export function renderEmailLayout(input: EmailLayoutInput): string {
  const success = input.highlight.tone === "success";
  const boxBg = success ? COLOR.accentSoft : COLOR.neutralSoft;
  const boxBorder = success ? COLOR.accent : COLOR.inkMuted;
  const eyebrowColor = success ? COLOR.accent : COLOR.inkSoft;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.canvas};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="background:${COLOR.brand};border-radius:12px 12px 0 0;padding:28px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-.3px;color:#FFFFFF;">CL<span style="color:#34D399;">Tech</span></td>
              <td align="right" style="font-family:${FONT};font-size:12px;color:${COLOR.inkMuted};">Processo seletivo</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="height:4px;line-height:4px;font-size:0;background:${success ? COLOR.accent : COLOR.inkMuted};">&nbsp;</td>
        </tr>
        <tr>
          <td style="background:${COLOR.surface};padding:36px 32px 8px;font-family:${FONT};">
            <div style="font-size:26px;line-height:32px;font-weight:700;color:${COLOR.ink};">${escapeHtml(input.headline)}</div>
            <p style="margin:12px 0 0;font-size:15px;line-height:24px;color:${COLOR.inkSoft};">${input.intro}</p>
          </td>
        </tr>
        <tr>
          <td style="background:${COLOR.surface};padding:20px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${boxBg};border-radius:10px;border-left:4px solid ${boxBorder};">
              <tr><td style="padding:18px 20px;font-family:${FONT};">
                <div style="font-size:12px;font-weight:700;letter-spacing:.6px;color:${eyebrowColor};">${escapeHtml(input.highlight.eyebrow)}</div>
                <div style="margin-top:4px;font-size:20px;line-height:28px;font-weight:700;color:${COLOR.ink};">${escapeHtml(input.highlight.title)}</div>
                <div style="margin-top:6px;font-size:14px;line-height:20px;color:${COLOR.inkSoft};">${escapeHtml(input.highlight.text)}</div>
              </td></tr>
            </table>
          </td>
        </tr>
        ${input.section ? `<tr><td style="background:${COLOR.surface};padding:8px 32px;font-family:${FONT};">${input.section}</td></tr>` : ""}
        <tr>
          <td align="center" style="background:${COLOR.surface};padding:28px 32px 36px;border-radius:0 0 12px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="border-radius:8px;background:${COLOR.accent};">
                <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:8px;">${escapeHtml(input.cta.label)} &rarr;</a>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 16px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${COLOR.inkMuted};">
            Você recebe este e-mail porque se candidatou a uma vaga pela CLTech.<br>
            Esta é uma mensagem automática — não precisa responder.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
