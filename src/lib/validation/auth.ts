import { z } from "zod";

const password = z.string().min(8, "A senha deve ter ao menos 8 caracteres.");
const email = z.string().trim().toLowerCase().email("E-mail inválido.");

// FR-001: cadastro com nome, e-mail e senha. Senha mínima de 8 caracteres
// (contracts/api.md POST /api/auth/register).
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome."),
  email,
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });

// Senha nova digitada duas vezes; o erro de diferença fica no campo de confirmação.
const newPassword = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "As senhas não são iguais.", path: ["confirm"] });

export const resetPasswordSchema = newPassword.and(z.object({ token: z.string().min(1, "Link inválido.") }));

export const changePasswordSchema = newPassword.and(z.object({ currentPassword: z.string().min(1, "Informe a senha atual.") }));
