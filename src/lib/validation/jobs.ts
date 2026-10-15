import { z } from "zod";

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
