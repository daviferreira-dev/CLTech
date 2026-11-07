import { z } from "zod";

// FR-049/FR-050: só a decisão é aceita — nenhum campo de score existe aqui de propósito,
// não por omissão (Princípio II).
export const meetingSchema = z.object({
  scheduledAt: z.string().datetime({ message: "Informe a data e a hora da reunião." }),
  url: z
    .string()
    .trim()
    .max(500)
    .url("Informe um link válido para a reunião.")
    .refine((value) => /^https:\/\//i.test(value), "O link da reunião deve começar com https://."),
});
export type MeetingInput = z.infer<typeof meetingSchema>;

/** Spec 009: motivos que o recrutador escolhe. POSITION_FILLED e JOB_CLOSED são do sistema. */
export const RECRUITER_REJECTION_REASONS = [
  "TECHNICAL_SKILLS",
  "CODE_TEST_SCORE",
  "INTERVIEW_PERFORMANCE",
  "REQUIREMENTS_NOT_MET",
  "NO_RESPONSE",
  "OTHER",
] as const;
export const REJECTION_FEEDBACK_MAX = 1000;

export const rejectionSchema = z.object({
  reason: z.enum(RECRUITER_REJECTION_REASONS, { message: "Escolha o motivo da reprovação." }),
  // Retorno ao candidato: vai no e-mail. Vazio = sem retorno.
  feedback: z.string().trim().max(REJECTION_FEEDBACK_MAX, `O retorno pode ter até ${REJECTION_FEEDBACK_MAX} caracteres.`).optional(),
});
export type RejectionInput = z.infer<typeof rejectionSchema>;

const requireRejection = (value: { decision: string; rejection?: unknown }, ctx: z.RefinementCtx) => {
  if (value.decision === "REJECT" && !value.rejection) {
    ctx.addIssue({ code: "custom", path: ["rejection"], message: "Escolha o motivo da reprovação." });
  }
};

export const recordDecisionSchema = z
  .object({
    decision: z.enum(["ADVANCE", "REJECT"]),
    // Obrigatória só ao avançar para uma entrevista (validado em recordDecision).
    meeting: meetingSchema.optional(),
    rejection: rejectionSchema.optional(),
  })
  .superRefine(requireRejection);

/** Spec 009: decisão em lote. Avançar para entrevista em lote é recusado (a reunião é individual). */
export const BULK_DECISION_MAX = 50;
export const bulkDecisionSchema = z
  .object({
    applicationIds: z
      .array(z.string().uuid())
      .min(1, "Selecione ao menos um candidato.")
      .max(BULK_DECISION_MAX, `Selecione no máximo ${BULK_DECISION_MAX} candidatos por vez.`),
    decision: z.enum(["ADVANCE", "REJECT"]),
    rejection: rejectionSchema.optional(),
  })
  .superRefine(requireRejection);
export type RecordDecisionInput = z.infer<typeof recordDecisionSchema>;

/** Spec 009 (FR-903): ficha de entrevista. As chaves de `scores` são conferidas no servidor
 * contra os critérios da etapa atual (src/lib/interviewCriteria.ts). */
export const interviewEvaluationSchema = z.object({
  scores: z.record(z.string(), z.number().int()),
  comment: z.string().trim().max(2000, "O comentário pode ter até 2000 caracteres.").optional(),
  recommendation: z.enum(["ADVANCE", "UNSURE", "REJECT"], { message: "Escolha uma recomendação." }),
});
export type InterviewEvaluationInput = z.infer<typeof interviewEvaluationSchema>;
