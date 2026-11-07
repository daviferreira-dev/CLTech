// Foto de perfil vinda do GitHub (`avatar_url`) ou do LinkedIn OIDC (`picture`).
// Só https destes hosts entra no banco — os mesmos liberados no img-src da CSP (src/lib/csp.ts).
// Não é exibida ao recrutador (decisão pendente: risco de viés na triagem).

import { prisma } from "@/lib/prisma";

export const AVATAR_HOSTS = ["avatars.githubusercontent.com", "media.licdn.com"] as const;
const LINKEDIN_HOST = "media.licdn.com";

function hostOf(url: string | null | undefined): string | null {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}

/** A URL, se for https de um host permitido; senão null. */
export function safeAvatarUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (AVATAR_HOSTS as readonly string[]).includes(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * Chamado a cada login OAuth. Grava a foto do provedor só se o usuário ainda não tiver uma.
 * Exceção: a URL do LinkedIn é assinada e expira, então foto do LinkedIn é renovada por outra
 * do LinkedIn. Devolve a foto que ficou gravada.
 */
export async function syncOAuthAvatar(userId: string, providerImage: unknown): Promise<string | null> {
  const next = safeAvatarUrl(providerImage);
  const { image } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { image: true } });
  const renewLinkedin = hostOf(next) === LINKEDIN_HOST && hostOf(image) === LINKEDIN_HOST;
  if (!next || (image && !renewLinkedin) || image === next) return image;
  await prisma.user.update({ where: { id: userId }, data: { image: next } });
  return next;
}
