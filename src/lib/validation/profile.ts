import { z } from "zod";

// FR-009: edição de nome, telefone, cidade/estado. E-mail não é editável aqui
// (é a chave de identidade — RN007).
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().length(2).optional().or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// RF02 / FR-010
export const connectExternalAccountSchema = z.object({
  provider: z.enum(["GITHUB", "LINKEDIN", "LATTES"]),
  url: z.string().url().optional(), // usado pelo Lattes, que é link manual
});

export type ConnectExternalAccountInput = z.infer<typeof connectExternalAccountSchema>;

// FR-014: PDF ou DOCX até 5 MB — validado também no servidor com magic number
// (ver src/server/candidates/resume.ts).
export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RESUME_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
