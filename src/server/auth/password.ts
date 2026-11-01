// "Esqueci minha senha" e troca de senha logado.
// O token vai só no e-mail; o banco guarda o SHA-256 dele (vazou a tabela, não vazou o link).
// Toda troca grava passwordChangedAt, que derruba as sessões JWT anteriores (session.ts).
import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { sendMail } from "@/server/email/mailer";
import { passwordChangedEmail, passwordResetEmail } from "@/server/email/templates/password";
import { LIMITS, hit, minutesUntil, retryMessage } from "@/server/auth/rate-limit";

const TOKEN_TTL_MS = 60 * 60_000;

const appUrl = () => process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function limit(limits: Parameters<typeof hit>[0]) {
  const blocked = await hit(limits);
  if (blocked) throw Errors.tooManyRequests(retryMessage(minutesUntil(blocked)));
}

/** Mesma resposta para e-mail existente ou não: quem chama não sabe se algo foi enviado. */
export async function requestPasswordReset(raw: unknown, ip: string): Promise<void> {
  const { email } = forgotPasswordSchema.parse(raw);
  await limit([LIMITS.resetIp(ip), LIMITS.resetEmail(email)]);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  // Um pedido novo invalida os anteriores.
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    }),
  ]);
  await sendMail(passwordResetEmail({ to: user.email, name: user.name, token, appUrl: appUrl() }));
}

async function setPassword(user: { id: string; name: string; email: string }, password: string) {
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await argon2.hash(password), passwordChangedAt: new Date() },
  });
  await sendMail(passwordChangedEmail({ to: user.email, name: user.name, appUrl: appUrl() }));
}

/** Uso único: o token sai da tabela no mesmo DELETE que o valida (dois cliques não trocam duas vezes). */
export async function resetPassword(raw: unknown, ip: string): Promise<{ email: string }> {
  const { token, password } = resetPasswordSchema.parse(raw);
  await limit([LIMITS.resetIp(ip)]);

  const [row] = await prisma.$queryRaw<{ userId: string }[]>`
    DELETE FROM "PasswordResetToken" WHERE "tokenHash" = ${hashToken(token)} AND "expiresAt" > now() RETURNING "userId"`;
  if (!row) throw Errors.businessRule("RESET_TOKEN_INVALID", "Este link expirou ou já foi usado. Peça um novo.");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: row.userId }, select: { id: true, name: true, email: true } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  // ponytail: sem passwordHash (conta só GitHub/LinkedIn) isto define a primeira senha.
  await setPassword(user, password);
  return { email: user.email };
}

export async function changePassword(userId: string, raw: unknown): Promise<{ email: string }> {
  const { currentPassword, password } = changePasswordSchema.parse(raw);
  await limit([LIMITS.changePassword(userId)]);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, passwordHash: true } });
  if (!user.passwordHash) {
    throw Errors.businessRule("NO_PASSWORD", "Sua conta entra pelo GitHub ou LinkedIn. Use \"Esqueci minha senha\" para criar uma senha.");
  }
  if (!(await argon2.verify(user.passwordHash, currentPassword))) {
    throw Errors.validation("A senha atual está incorreta.");
  }
  await setPassword(user, password);
  return { email: user.email };
}
