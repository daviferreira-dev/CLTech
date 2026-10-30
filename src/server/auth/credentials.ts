// Login por e-mail e senha (provedor Credentials), separado do config.ts para ser testável.
import * as argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { LIMITS, blockedUntil, clear, hit, minutesUntil } from "@/server/auth/rate-limit";

/** Limite estourado (vale igual para e-mail existente ou não); config.ts o repassa ao LoginForm. */
export class TooManyAttempts extends Error {
  readonly code: string;
  constructor(until: Date) {
    super("Muitas tentativas de login.");
    this.code = `blocked_${minutesUntil(until)}`;
  }
}

export async function authorizeCredentials(raw: unknown, ip: string) {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  const limits = [LIMITS.loginIp(ip), LIMITS.loginEmail(email)];
  const blocked = await blockedUntil(limits);
  if (blocked) throw new TooManyAttempts(blocked);

  const user = await prisma.user.findUnique({ where: { email } });
  // FR-004: não revelar se o e-mail existe — mesma resposta genérica (null)
  // tanto para usuário inexistente quanto para senha incorreta.
  const valid = !!user?.passwordHash && (await argon2.verify(user.passwordHash, password));
  if (!user || !valid) {
    await hit(limits);
    return null;
  }

  await clear(LIMITS.loginEmail(email));
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
