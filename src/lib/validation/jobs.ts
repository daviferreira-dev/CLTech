import { z } from "zod";
import { EMAIL_BODY_MAX, EMAIL_SUBJECT_MAX } from "@/lib/emailTemplate";

// Vazio/ausente: a etapa usa o e-mail padrão (o builder grava null).
const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} pode ter no máximo ${max} caracteres.`).nullish();
const stageEmailFields = {
  // B5: quebra de linha no assunto viraria cabeçalho novo no e-mail.
  emailSubject: optionalText(EMAIL_SUBJECT_MAX, "O assunto do e-mail").refine(
    (v) => !v || !/[\r\n]/.test(v),
    "O assunto do e-mail não pode ter quebra de linha.",
  ),
  emailBody: optionalText(EMAIL_BODY_MAX, "O texto do e-mail"),
};

// FR-019: filtros da listagem pública de vagas.
export const jobListQuerySchema = z.object({
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
  seniority: z.enum(["INTERN", "JUNIOR", "MID", "SENIOR"]).optional(),
  technology: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;

// FR-038: criação/edição de vaga pelo recrutador. Todos os campos existem na criação;
// na edição (PATCH), o schema de atualização torna todos opcionais.
const jobFieldsSchema = {
  title: z.string().trim().min(1, "Informe o título da vaga."),
  description: z.string().trim().min(1, "Informe a descrição da vaga."),
  company: z.string().trim().min(1, "Informe a empresa."),
  location: z.string().trim().min(1, "Informe a localização."),
  workMode: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
  seniority: z.enum(["INTERN", "JUNIOR", "MID", "SENIOR"]),
  technologies: z.array(z.string().trim().min(1)),
  minimumRequirements: z.string().trim().min(1, "Informe os requisitos mínimos."),
};

export const createJobSchema = z.object(jobFieldsSchema);
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = z.object(
  Object.fromEntries(Object.entries(jobFieldsSchema).map(([key, schema]) => [key, schema.optional()])),
) as z.ZodType<Partial<CreateJobInput>>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

// FR-039/FR-042: substituição completa e ordenada das etapas de uma vaga em rascunho (R16).
export const PROCESS_STAGE_TYPES = [
  "RESUME_ANALYSIS",
  "CODE_TEST",
  "GITHUB_ANALYSIS",
  "HR_INTERVIEW",
  "TECH_INTERVIEW",
  "FINAL_OFFER",
] as const;

export const setStagesSchema = z.object({
  stages: z.array(
    z.object({
      type: z.enum(PROCESS_STAGE_TYPES),
      config: z.record(z.string(), z.unknown()).optional(),
      ...stageEmailFields,
    }),
  ),
});
export type SetStagesInput = z.infer<typeof setStagesSchema>;

// Template do e-mail de entrevista: editável mesmo com a vaga publicada (é só texto).
export const stageEmailSchema = z.object({ stageId: z.string().uuid(), ...stageEmailFields });
export type StageEmailInput = z.infer<typeof stageEmailSchema>;
