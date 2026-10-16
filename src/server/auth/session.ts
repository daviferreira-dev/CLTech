// Checagem de papel no servidor — FR-008 ("verificando a permissão no servidor a
// cada acesso") e FR-017 (acesso a dado pessoal restrito por papel). Nenhuma
// decisão de autorização é tomada só no cliente.

import { auth } from "@/server/auth/config";
import { Errors } from "@/lib/errors";

type Role = "CANDIDATE" | "RECRUITER" | "ADMIN";

export interface AuthedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
}

/** Lança 401 se não houver sessão. Use em toda rota que exige autenticação. */
export async function requireSession(): Promise<AuthedUser> {
  const session = await auth();
  if (!session?.user) throw Errors.unauthenticated();
  return session.user as AuthedUser;
}

/** Lança 401/403. Use em toda rota restrita por papel (ex.: área de recrutamento). */
export async function requireRole(allowed: Role[]): Promise<AuthedUser> {
  const user = await requireSession();
  if (!allowed.includes(user.role)) throw Errors.forbidden();
  return user;
}

/** Nunca lança — null sem sessão. Use em rota pública que se comporta diferente quando autenticada (FR-035). */
export async function getOptionalSession(): Promise<AuthedUser | null> {
  const session = await auth();
  return (session?.user as AuthedUser | undefined) ?? null;
}
