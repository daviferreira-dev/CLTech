// B1: CRON_SECRET comparado em tempo constante.
import { timingSafeEqual } from "node:crypto";

export function authorizedCron(header: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
