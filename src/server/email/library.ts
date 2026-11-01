// Biblioteca de modelos de e-mail do RH (spec 008, /recrutamento/modelos-de-email). Modelo
// padrão de cada momento (defaultFor != null) é semeado pela migration — o RH edita o texto,
// mas não duplica nem apaga (sempre precisa haver um, ver resolve.ts). Modelo livre
// (defaultFor null) é criado/editado/duplicado/excluído sem restrição, a não ser em uso.
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import type { EmailTemplateInput, UpdateEmailTemplateInput } from "@/lib/validation/emailTemplates";

export async function listEmailTemplates() {
  return prisma.emailTemplate.findMany({ orderBy: { name: "asc" } });
}

export async function createEmailTemplate(input: EmailTemplateInput) {
  return prisma.emailTemplate.create({ data: input });
}

export async function updateEmailTemplate(id: string, input: UpdateEmailTemplateInput) {
  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Modelo de e-mail");
  return prisma.emailTemplate.update({ where: { id }, data: input });
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const template = await prisma.emailTemplate.findUnique({ where: { id }, select: { defaultFor: true } });
  if (!template) throw Errors.notFound("Modelo de e-mail");
  if (template.defaultFor) {
    throw Errors.conflict("TEMPLATE_IS_DEFAULT", "O modelo padrão de um momento não pode ser excluído — edite o texto dele.");
  }

  const [stage, job] = await Promise.all([
    prisma.processStage.findFirst({ where: { emailTemplateId: id }, select: { id: true } }),
    prisma.job.findFirst({ where: { OR: [{ rejectedEmailTemplateId: id }, { approvedEmailTemplateId: id }] }, select: { id: true } }),
  ]);
  if (stage || job) {
    throw Errors.conflict("TEMPLATE_IN_USE", "Este modelo está em uso por alguma vaga. Troque o modelo nela antes de excluir.");
  }

  await prisma.emailTemplate.delete({ where: { id } });
}
