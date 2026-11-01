// E-mails de senha: o link de redefinição e o aviso de que a senha mudou.
// O aviso vai depois de toda troca (logado ou pelo link): é como o dono percebe um invasor.
import type { MailMessage } from "../mailer";
import { firstName, joinUrl, renderEmailLayout } from "./layout";

const FOOTER = "Você recebe este e-mail porque tem uma conta na CLTech.";

export interface PasswordResetEmailInput {
  to: string;
  name: string;
  token: string;
  appUrl: string;
}

export function passwordResetEmail(input: PasswordResetEmailInput): MailMessage {
  const name = firstName(input.name);
  const href = joinUrl(input.appUrl, `/redefinir-senha?token=${encodeURIComponent(input.token)}`);
  const subject = "Redefina sua senha da CLTech";
  const note = "O link vale por 1 hora e funciona uma vez só. Se você não pediu, ignore este e-mail: sua senha continua a mesma.";

  const html = renderEmailLayout({
    subject,
    preheader: "Use o link para criar uma senha nova.",
    headline: `Olá, ${name}`,
    intro: "Recebemos um pedido para redefinir a senha da sua conta. Clique no botão para criar uma senha nova.",
    highlight: { tone: "neutral", eyebrow: "VALE POR 1 HORA", title: "Link de uso único", text: note },
    cta: { label: "Criar senha nova", href },
    footer: FOOTER,
  });

  const text = [`Olá, ${name}`, "", "Recebemos um pedido para redefinir a senha da sua conta.", "", `Criar senha nova: ${href}`, "", note, "", "— CLTech"].join("\n");
  return { to: input.to, subject, html, text };
}

export interface PasswordChangedEmailInput {
  to: string;
  name: string;
  appUrl: string;
}

export function passwordChangedEmail(input: PasswordChangedEmailInput): MailMessage {
  const name = firstName(input.name);
  const href = joinUrl(input.appUrl, "/esqueci-senha");
  const subject = "Sua senha da CLTech foi alterada";
  const warning = "Se não foi você, redefina a senha agora: isso desconecta quem estiver usando a sua conta.";

  const html = renderEmailLayout({
    subject,
    preheader: "Se não foi você, redefina agora.",
    headline: `Olá, ${name}`,
    intro: "A senha da sua conta acabou de ser alterada, e as sessões abertas em outros aparelhos foram encerradas.",
    highlight: { tone: "neutral", eyebrow: "NÃO FOI VOCÊ?", title: "Redefina sua senha agora", text: warning },
    cta: { label: "Redefinir senha", href },
    footer: FOOTER,
  });

  const text = [`Olá, ${name}`, "", "A senha da sua conta acabou de ser alterada, e as sessões abertas em outros aparelhos foram encerradas.", "", warning, `Redefinir senha: ${href}`, "", "— CLTech"].join("\n");
  return { to: input.to, subject, html, text };
}
