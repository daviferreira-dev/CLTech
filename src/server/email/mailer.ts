// RN005 — envio de e-mail transacional por SMTP (Gmail, Outlook ou qualquer servidor).
// Sem SMTP_HOST/USER/PASS o envio fica desligado e nada quebra: o e-mail é aviso, não etapa
// do fluxo. Falha de envio só vai pro log — nunca derruba a decisão do recrutador.
import nodemailer, { type Transporter } from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    // 465 é TLS direto; 587/25 sobem pra TLS via STARTTLS.
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

// SMTP_FROM aceita só o nome ("CLTech") ou o endereço completo ("Nome <email>").
function fromAddress(): string {
  const from = process.env.SMTP_FROM?.trim() || "CLTech";
  if (from.includes("@")) return from;
  return `"${from.replace(/"/g, "")}" <${process.env.SMTP_USER}>`;
}

export function isMailEnabled(): boolean {
  return getTransporter() !== null;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const transport = getTransporter();
  if (!transport) return;
  try {
    await transport.sendMail({ from: fromAddress(), ...message });
  } catch (err) {
    console.error("[email] Falha ao enviar e-mail:", err instanceof Error ? err.message : err);
  }
}
