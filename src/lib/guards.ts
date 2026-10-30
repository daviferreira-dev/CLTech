// Regra de guarda FR-G (spec 004, FR-101), aplicada no servidor por toda página protegida:
// sessão ausente → /entrar?callbackUrl=<rota atual completa, com query>; papel errado →
// destinationForRole(role). Nunca um 403 em branco.
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { destinationForRole } from "@/server/auth/redirect";
import { requireSession } from "@/server/auth/session";
import { ApiError } from "@/lib/errors";

export { safeInternalPath } from "./safe-path";

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

/** Papel relido no banco (requireSession), não o do JWT: rebaixado ou excluído perde o acesso já (M2). */
export async function requirePageRole(allowed: Role[], path: string) {
  const user = await requireSession().catch((err) => {
    if (err instanceof ApiError) return null;
    throw err;
  });
  if (!user) redirect(loginUrl(path));
  if (!allowed.includes(user.role)) redirect(destinationForRole(user.role));
  return user;
}

/** `<title>` com dado real (nome da vaga, do candidato) só para quem pode ver a página. */
export async function recruiterTitle<T>(load: () => Promise<T | null>, fallback: string, format: (value: T) => string) {
  const session = await auth();
  if (!session?.user || !RECRUITER_ROLES.includes(session.user.role)) return { title: fallback };
  const value = await load().catch(() => null);
  return { title: value ? format(value) : fallback };
}
