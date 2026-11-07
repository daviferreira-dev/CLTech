// Biblioteca de modelos de e-mail do RH (spec 008, /recrutamento/modelos-de-email). Modelo
// padrão de cada momento (defaultFor != null) é semeado pela migration — o RH edita o texto,
// mas não duplica nem apaga (sempre precisa haver um, ver resolve.ts). Modelo livre
// (defaultFor null) é criado/editado/duplicado/excluído sem restrição; ao excluir, quem o usava volta ao padrão.
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

  // Quem usa o modelo volta ao padrão do momento, na mesma transação da exclusão (o banco tem
  // ON DELETE RESTRICT: sem isso o delete falharia).
  const toDefault = { emailMode: "DEFAULT", emailTemplateId: null } as const;
  await prisma.$transaction([
    prisma.processStage.updateMany({ where: { emailTemplateId: id }, data: toDefault }),
    prisma.job.updateMany({
      where: { rejectedEmailTemplateId: id },
      data: { rejectedEmailMode: "DEFAULT", rejectedEmailTemplateId: null },
    }),
    prisma.job.updateMany({
      where: { approvedEmailTemplateId: id },
      data: { approvedEmailMode: "DEFAULT", approvedEmailTemplateId: null },
    }),
    prisma.emailTemplate.delete({ where: { id } }),
  ]);
}

/** Títulos das vagas que usam cada modelo (etapa, "reprovado" ou "aprovado"), por id do modelo. */
export async function listTemplateUsage(): Promise<Record<string, string[]>> {
  const templates = await prisma.emailTemplate.findMany({
    where: { defaultFor: null },
    select: {
      id: true,
      stages: { select: { job: { select: { title: true } } } },
      jobsRejected: { select: { title: true } },
      jobsApproved: { select: { title: true } },
    },
  });
  return Object.fromEntries(
    templates.map((t) => [
      t.id,
      [...new Set([...t.stages.map((s) => s.job.title), ...t.jobsRejected.map((j) => j.title), ...t.jobsApproved.map((j) => j.title)])],
    ]),
  );
}
