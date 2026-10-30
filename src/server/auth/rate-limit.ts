// A2 (relatorio-seguranca.md): limite de tentativas no login e no cadastro, por IP e por e-mail.
// Janela fixa numa tabela do Postgres: vale para todas as instâncias da Vercel ao mesmo tempo,
// o que memória do processo não garante.
import { prisma } from "@/lib/prisma";

export interface Limit {
  key: string;
  max: number;
  windowMs: number;
}

const MINUTE = 60_000;
const WINDOW = 15 * MINUTE;

export const LIMITS = {
  // Login conta só as falhas; acertar a senha zera o contador do e-mail.
  loginIp: (ip: string): Limit => ({ key: `login:ip:${ip}`, max: 30, windowMs: WINDOW }),
  loginEmail: (email: string): Limit => ({ key: `login:email:${email}`, max: 5, windowMs: WINDOW }),
  // Cadastro conta toda tentativa: cada uma custa um hash Argon2.
  registerIp: (ip: string): Limit => ({ key: `register:ip:${ip}`, max: 30, windowMs: WINDOW }),
  registerEmail: (email: string): Limit => ({ key: `register:email:${email}`, max: 5, windowMs: WINDOW }),
};

/** Na Vercel o primeiro valor do x-forwarded-for é o IP real (a plataforma reescreve o cabeçalho). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/** Registra uma tentativa em cada chave; devolve até quando alguma passou do limite, ou null. */
export async function hit(limits: Limit[]): Promise<Date | null> {
  let until: Date | null = null;
  for (const { key, max, windowMs } of limits) {
    const [row] = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + ${windowMs}::int * interval '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"`;
    if (row && row.count > max && (!until || row.resetAt > until)) until = row.resetAt;
  }
  return until;
}

/** Sem registrar nada: até quando alguma chave já esgotou o limite, ou null. */
export async function blockedUntil(limits: Limit[]): Promise<Date | null> {
  const rows = await prisma.rateLimit.findMany({ where: { key: { in: limits.map((l) => l.key) }, resetAt: { gt: new Date() } } });
  const blocked = rows.filter((r) => r.count >= limits.find((l) => l.key === r.key)!.max);
  return blocked.length ? new Date(Math.max(...blocked.map((r) => r.resetAt.getTime()))) : null;
}

export async function clear(limit: Limit): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key: limit.key } });
}

export function minutesUntil(until: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - Date.now()) / MINUTE));
}

export function retryMessage(minutes: number): string {
  return `Muitas tentativas. Tente de novo em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;
}
