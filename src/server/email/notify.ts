// Ponto único que escolhe (resolveEmail) e envia o e-mail de cada momento do processo
// seletivo — usado por apply.ts, decision.ts e jobs/builder.ts (encerrar vaga). Nunca lança:
// falha de resolução ou de envio só vai pro log, como todo e-mail aqui (mailer.ts) — nunca
// bloqueia a decisão do recrutador.
import { sendMail } from "./mailer";
import { resolveEmail, type EmailOverride } from "./resolve";
import { applicationReceivedEmail } from "./templates/application-received";
import { stageAdvancedEmail } from "./templates/stage-advanced";
import { rejectedEmail } from "./templates/rejected";
import type { EmailMoment } from "@/lib/emailMoments";
import { logSafeError } from "@/lib/errors";

interface Person {
  name: string;
  email: string;
}

export async function notifyApplicationReceived(input: { to: Person; jobTitle: string; company: string; appUrl: string }): Promise<void> {
  try {
    const resolved = await resolveEmail("APPLICATION_RECEIVED");
    if (!resolved) return;
    await sendMail(
      applicationReceivedEmail({
        to: input.to.email,
        candidateName: input.to.name,
        jobTitle: input.jobTitle,
        company: input.company,
        template: resolved,
        appUrl: input.appUrl,
      }),
    );
  } catch (err) {
    logSafeError("email:APPLICATION_RECEIVED", err);
  }
}

export async function notifyStageAdvanced(input: {
  to: Person;
  jobTitle: string;
  company: string;
  stages: Array<{ type: string; order: number }>;
  /** `null` quando avançar da última etapa aprovou (moment deve ser "APPROVED"). */
  newStageOrder: number | null;
  meeting?: { at: Date; url: string };
  codeTestMinutes?: number;
  moment: EmailMoment;
  override: EmailOverride | null;
  appUrl: string;
}): Promise<void> {
  try {
    const resolved = await resolveEmail(input.moment, input.override);
    if (!resolved) return;
    await sendMail(
      stageAdvancedEmail({
        to: input.to.email,
        candidateName: input.to.name,
        jobTitle: input.jobTitle,
        company: input.company,
        stages: input.stages,
        newStageOrder: input.newStageOrder,
        meeting: input.meeting,
        codeTestMinutes: input.codeTestMinutes,
        template: resolved,
        appUrl: input.appUrl,
      }),
    );
  } catch (err) {
    logSafeError(`email:${input.moment}`, err);
  }
}

/** Reprovação (REJECTED) ou vaga encerrada com a candidatura ainda em andamento (JOB_CLOSED). */
export async function notifyApplicationClosed(input: {
  to: Person;
  jobTitle: string;
  company: string;
  stageType: string;
  moment: "REJECTED" | "JOB_CLOSED";
  /** JOB_CLOSED não tem configuração por vaga (ver JOB_CONFIGURABLE_MOMENTS). */
  override?: EmailOverride | null;
  appUrl: string;
  /** Spec 009: motivo (rótulo) e retorno do recrutador, só na reprovação. */
  reasonLabel?: string;
  feedback?: string | null;
}): Promise<void> {
  try {
    const resolved = await resolveEmail(input.moment, input.override);
    if (!resolved) return;
    await sendMail(
      rejectedEmail({
        to: input.to.email,
        candidateName: input.to.name,
        jobTitle: input.jobTitle,
        company: input.company,
        stageType: input.stageType,
        template: resolved,
        appUrl: input.appUrl,
        reasonLabel: input.reasonLabel,
        feedback: input.feedback,
      }),
    );
  } catch (err) {
    logSafeError(`email:${input.moment}`, err);
  }
}
