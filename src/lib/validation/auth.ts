import { z } from "zod";

// FR-001: cadastro com nome, e-mail e senha. Senha mínima de 8 caracteres
// (contracts/api.md POST /api/auth/register).
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export type LoginInput = z.infer<typeof loginSchema>;
