// Spec 008: resolução vaga → modelo → padrão de um momento (resolve.ts).
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveEmail } from "@/server/email/resolve";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/emailMoments";

describe("resolveEmail", () => {
  it("sem override (momento global), usa o modelo padrão da biblioteca", async () => {
    const resolved = await resolveEmail("APPLICATION_RECEIVED");
    expect(resolved).toEqual({
      subject: DEFAULT_EMAIL_TEMPLATES.APPLICATION_RECEIVED.subject,
      body: DEFAULT_EMAIL_TEMPLATES.APPLICATION_RECEIVED.body,
    });
  });

  it("DEFAULT (ou sem override) usa o padrão — mesmo depois de editado pelo RH", async () => {
    await prisma.emailTemplate.update({ where: { defaultFor: "REJECTED" }, data: { subject: "Editado", body: "Corpo editado" } });
    const resolved = await resolveEmail("REJECTED", { emailMode: "DEFAULT", emailTemplateId: null, emailSubject: null, emailBody: null });
    expect(resolved).toEqual({ subject: "Editado", body: "Corpo editado" });
  });

  it("TEMPLATE usa o modelo escolhido da biblioteca", async () => {
    const template = await prisma.emailTemplate.create({ data: { name: "Modelo X", subject: "Assunto X", body: "Corpo X" } });
    const resolved = await resolveEmail("APPROVED", { emailMode: "TEMPLATE", emailTemplateId: template.id, emailSubject: null, emailBody: null });
    expect(resolved).toEqual({ subject: "Assunto X", body: "Corpo X" });
  });

  it("TEMPLATE com id que não existe mais cai para o padrão", async () => {
    const resolved = await resolveEmail("APPROVED", { emailMode: "TEMPLATE", emailTemplateId: "00000000-0000-0000-0000-000000000000", emailSubject: null, emailBody: null });
    expect(resolved).toEqual({ subject: DEFAULT_EMAIL_TEMPLATES.APPROVED.subject, body: DEFAULT_EMAIL_TEMPLATES.APPROVED.body });
  });

  it("CUSTOM usa o texto próprio", async () => {
    const resolved = await resolveEmail("JOB_CLOSED", { emailMode: "CUSTOM", emailTemplateId: null, emailSubject: "Assunto próprio", emailBody: "Corpo próprio" });
    expect(resolved).toEqual({ subject: "Assunto próprio", body: "Corpo próprio" });
  });

  it("OFF não resolve nada", async () => {
    const resolved = await resolveEmail("STAGE_ADVANCED_CODE_TEST", { emailMode: "OFF", emailTemplateId: null, emailSubject: null, emailBody: null });
    expect(resolved).toBeNull();
  });
});
