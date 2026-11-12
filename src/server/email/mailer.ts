// RN005 — envio de e-mail transacional por SMTP (Gmail, Outlook ou qualquer servidor).
// Sem SMTP_HOST/USER/PASS o envio fica desligado e nada quebra: o e-mail é aviso, não etapa
// do fluxo. Falha de envio só vai pro log — nunca derruba a decisão do recrutador.
// Falha temporária (rede, 4xx do SMTP) tenta de novo com espera crescente; sem fila nem tabela.
import nodemailer, { type Transporter } from "nodemailer";
import { logSafeError } from "@/lib/errors";

// 3 tentativas, esperas de 1s e 3s. Com o timeout de 5s por tentativa o pior caso fica em ~19s,
// dentro do limite de uma função com Fluid compute; quem chama sem await (keepAlive) nem sente.
// ponytail: se um dia o envio precisar sobreviver a queda longa do SMTP, aí sim vale uma fila.
export const RETRY_DELAYS_MS = [1000, 3000];
const ATTEMPT_TIMEOUT_MS = 5000;

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
    connectionTimeout: ATTEMPT_TIMEOUT_MS,
    greetingTimeout: ATTEMPT_TIMEOUT_MS,
    socketTimeout: ATTEMPT_TIMEOUT_MS,
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

// 5xx do SMTP é definitivo (senha errada, destinatário inexistente): repetir não adianta.
function isPermanent(err: unknown): boolean {
  const code = (err as { responseCode?: unknown })?.responseCode;
  return typeof code === "number" && code >= 500;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const transport = getTransporter();
  if (!transport) return;
  for (let attempt = 0; ; attempt++) {
    try {
      await transport.sendMail({ from: fromAddress(), ...message });
      return;
    } catch (err) {
      if (isPermanent(err) || attempt >= RETRY_DELAYS_MS.length) {
        logSafeError(`email:envio falhou após ${attempt + 1} tentativa(s)`, err);
        return;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}
