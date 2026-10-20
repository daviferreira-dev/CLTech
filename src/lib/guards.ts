// Regra de guarda FR-G (spec 004, FR-101), aplicada no servidor por toda página protegida:
// sessão ausente → /entrar?callbackUrl=<rota atual completa, com query>; papel errado →
// destinationForRole(role). Nunca um 403 em branco.
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { destinationForRole } from "@/server/auth/redirect";

type Role = "CANDIDATE" | "RECRUITER" | "ADMIN";

export const RECRUITER_ROLES: Role[] = ["RECRUITER", "ADMIN"];
export const CANDIDATE_ROLES: Role[] = ["CANDIDATE"];

export type PageSearchParams = Record<string, string | string[] | undefined>;

/** Reconstrói a rota atual com a query, para o callbackUrl voltar exatamente ao mesmo ponto. */
export function currentPath(pathname: string, searchParams?: PageSearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
    else if (value !== undefined) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function loginUrl(callbackPath: string): string {
  return `/entrar?callbackUrl=${encodeURIComponent(callbackPath)}`;
}

export async function requirePageRole(allowed: Role[], path: string) {
  const session = await auth();
  if (!session?.user?.role) redirect(loginUrl(path));
  if (!allowed.includes(session.user.role)) redirect(destinationForRole(session.user.role));
  return session.user;
}

/**
 * Só aceita destino interno (`/algo`), nunca `//host` nem URL absoluta — `?next=` e
 * `callbackUrl` vêm da query e não podem virar redirecionamento aberto.
 */
export function safeInternalPath(value: string | string[] | undefined | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}
