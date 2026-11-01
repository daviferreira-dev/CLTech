// Resolve o e-mail de um momento do processo seletivo: o texto próprio da vaga/etapa, senão o
// modelo da biblioteca escolhido, senão o modelo padrão do momento (sempre presente — ver a
// migration de EmailTemplate). "Desligado" devolve null: quem chama não envia nada.
import { prisma } from "@/lib/prisma";
import { logSafeError } from "@/lib/errors";
import type { EmailMoment } from "@/lib/emailMoments";

export interface ResolvedEmail {
  subject: string;
  body: string;
}

/** Mesmo formato em ProcessStage (emailMode/emailTemplateId/emailSubject/emailBody) e nos
 * campos "rejectedEmail…"/"approvedEmail…" de Job — ver resolveEmail. */
export interface EmailOverride {
  emailMode: "DEFAULT" | "TEMPLATE" | "CUSTOM" | "OFF";
  emailTemplateId: string | null;
  emailSubject: string | null;
  emailBody: string | null;
}

async function defaultTemplate(moment: EmailMoment): Promise<ResolvedEmail | null> {
  const template = await prisma.emailTemplate.findUnique({ where: { defaultFor: moment } });
  if (!template) {
    // Não devia acontecer (a migration semeia um por momento, e defaultFor não pode ser
    // apagado — ver templates.ts). Melhor não mandar e-mail quebrado do que travar a decisão.
    logSafeError(`email:resolve:${moment}`, new Error(`Modelo padrão ausente para o momento ${moment}.`));
    return null;
  }
  return { subject: template.subject, body: template.body };
}

/**
 * `override` é `null`/`undefined` para momentos sem configuração por vaga (candidatura
 * recebida, vaga encerrada): sempre usam o modelo padrão da biblioteca.
 */
export async function resolveEmail(moment: EmailMoment, override?: EmailOverride | null): Promise<ResolvedEmail | null> {
  if (!override || override.emailMode === "DEFAULT") return defaultTemplate(moment);
  if (override.emailMode === "OFF") return null;

  if (override.emailMode === "CUSTOM") {
    if (override.emailSubject?.trim() && override.emailBody?.trim()) {
      return { subject: override.emailSubject, body: override.emailBody };
    }
    return defaultTemplate(moment);
  }

  // TEMPLATE
  if (override.emailTemplateId) {
    const template = await prisma.emailTemplate.findUnique({ where: { id: override.emailTemplateId } });
    if (template) return { subject: template.subject, body: template.body };
  }
  return defaultTemplate(moment);
}
