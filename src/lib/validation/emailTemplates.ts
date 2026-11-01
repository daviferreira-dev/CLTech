import { z } from "zod";
import { EMAIL_BODY_MAX, EMAIL_NAME_MAX, EMAIL_SUBJECT_MAX } from "@/lib/emailTemplate";

// Spec 008 — biblioteca de modelos de e-mail do RH (/recrutamento/modelos-de-email).
export const emailTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe um nome para o modelo.")
    .max(EMAIL_NAME_MAX, `O nome pode ter no máximo ${EMAIL_NAME_MAX} caracteres.`),
  subject: z
    .string()
    .trim()
    .min(1, "Informe o assunto.")
    .max(EMAIL_SUBJECT_MAX, `O assunto pode ter no máximo ${EMAIL_SUBJECT_MAX} caracteres.`)
    // B5: quebra de linha no assunto viraria cabeçalho novo no e-mail.
    .refine((v) => !/[\r\n]/.test(v), "O assunto não pode ter quebra de linha."),
  body: z
    .string()
    .trim()
    .min(1, "Informe o corpo do e-mail.")
    .max(EMAIL_BODY_MAX, `O corpo pode ter no máximo ${EMAIL_BODY_MAX} caracteres.`),
});
export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;

export const updateEmailTemplateSchema = emailTemplateSchema.partial();
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;
