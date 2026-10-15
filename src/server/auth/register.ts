// FR-001 / FR-004 / FR-007: cadastro de candidato.
// Função pura (sem HTTP) para ser testável diretamente — ver tests/integration/auth.test.ts.

import * as argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

export interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  role: "CANDIDATE";
}

export async function registerCandidate(input: RegisterInput): Promise<RegisteredUser> {
  const { name, email, password } = registerSchema.parse(input);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // FR-004: mensagem genérica, nunca "e-mail já cadastrado" — evita enumeração de usuários.
    throw Errors.conflict(
      "REGISTRATION_FAILED",
      "Não foi possível criar a conta com esses dados.",
    );
  }

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "CANDIDATE" },
  });

  // Garante que o perfil de Candidate já exista (1:1 com User) para as próximas
  // sprints e para o fluxo de perfil (RF02) funcionar sem passo extra.
  await prisma.candidate.create({ data: { userId: user.id } });

  return { id: user.id, name: user.name, email: user.email, role: "CANDIDATE" };
}
