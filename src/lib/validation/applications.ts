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
    .refine((value) => /^https?:\/\//i.test(value), "O link da reunião deve começar com http:// ou https://."),
});
export type MeetingInput = z.infer<typeof meetingSchema>;

export const recordDecisionSchema = z.object({
  decision: z.enum(["ADVANCE", "REJECT"]),
  // Obrigatória só ao avançar para uma entrevista (validado em recordDecision).
  meeting: meetingSchema.optional(),
});
export type RecordDecisionInput = z.infer<typeof recordDecisionSchema>;
