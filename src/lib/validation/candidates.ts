import { z } from "zod";

// FR-051: busca por nome, e-mail ou tecnologia.
export const candidateSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "Informe um termo de busca."),
});
export type CandidateSearchQuery = z.infer<typeof candidateSearchQuerySchema>;
