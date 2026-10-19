// Checagem de papel no servidor — FR-008 ("verificando a permissão no servidor a
// cada acesso") e FR-017 (acesso a dado pessoal restrito por papel). Nenhuma
// decisão de autorização é tomada só no cliente.

import { auth } from "@/server/auth/config";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

type Role = "CANDIDATE" | "RECRUITER" | "ADMIN";

export interface AuthedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
}

/**
 * Lança 401 se não houver sessão ou se ela não corresponder mais a um usuário real.
 * Use em toda rota que exige autenticação.
 *
 * A estratégia é "jwt" (config.ts): a sessão vive no cookie assinado, não no banco. Um
 * token continua válido criptograficamente depois que o usuário é excluído, e aí o erro
 * só aparecia no INSERT, como violação de chave estrangeira (500) em vez de 401. Acontece
 * de verdade: conta excluída por LGPD com o cookie ainda no navegador, e em dev sempre que
 * a suíte de integração trunca o banco.
 *
 * O papel também vem do banco, não do token: um JWT emitido antes de uma mudança de papel
 * carrega o papel antigo, e FR-008 exige verificar a permissão no servidor a cada acesso.
 */
export async function requireSession(): Promise<AuthedUser> {
  const session = await auth();
  if (!session?.user) throw Errors.unauthenticated();

  const claimedId = (session.user as AuthedUser).id;
  if (!claimedId) throw Errors.unauthenticated();

  const user = await prisma.user.findUnique({
    where: { id: claimedId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw Errors.unauthenticated();

  return user as AuthedUser;
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
