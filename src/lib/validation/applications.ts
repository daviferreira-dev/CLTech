import { z } from "zod";

// FR-049/FR-050: só a decisão é aceita — nenhum campo de score existe aqui de propósito,
// não por omissão (Princípio II).
export const recordDecisionSchema = z.object({
  decision: z.enum(["ADVANCE", "REJECT"]),
});
export type RecordDecisionInput = z.infer<typeof recordDecisionSchema>;
