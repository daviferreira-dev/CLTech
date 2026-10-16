// FR-011 / FR-012 / R6: coleta server-side do GitHub. Roda fora do caminho crítico
// de candidatura — qualquer falha (404, privado, rate limit, timeout) grava
// UNAVAILABLE com motivo e NUNCA propaga exceção.

import { prisma } from "@/lib/prisma";
import { recomputeJobMatchesForCandidate } from "@/server/matching/recompute";

const GITHUB_API = "https://api.github.com";

interface GithubRepo {
  language: string | null;
  size: number;
}

interface GithubUserResponse {
  public_repos: number;
  followers: number;
}

export interface CollectResult {
  ok: boolean;
  reason?: string;
}

/**
 * Coleta dados do GitHub e grava o snapshot em GithubProfile, ou marca o vínculo
 * como UNAVAILABLE com o motivo. Não lança — o chamador sempre recebe um resultado.
 */
export async function collectGithubProfile(
  candidateId: string,
  username: string,
): Promise<CollectResult> {
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    const token = process.env.GITHUB_COLLECTION_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const userRes = await fetchWithTimeout(`${GITHUB_API}/users/${username}`, headers);
    if (userRes.status === 404) {
      return fail(candidateId, "Perfil do GitHub não encontrado (404)");
    }
    if (userRes.status === 403) {
      return fail(candidateId, "Limite de requisições da API do GitHub atingido");
    }
    if (!userRes.ok) {
      return fail(candidateId, `Falha ao consultar o GitHub (status ${userRes.status})`);
    }
    const user = (await userRes.json()) as GithubUserResponse;

    const reposRes = await fetchWithTimeout(
      `${GITHUB_API}/users/${username}/repos?per_page=100&type=public`,
      headers,
    );
    const repos: GithubRepo[] = reposRes.ok ? await reposRes.json() : [];

    const eventsRes = await fetchWithTimeout(`${GITHUB_API}/users/${username}/events/public`, headers);
    const events: unknown[] = eventsRes.ok ? await eventsRes.json() : [];
    const activityLast90Days = Array.isArray(events) ? events.length : 0;

    const languages = aggregateLanguagesByBytes(repos);

    await prisma.githubProfile.upsert({
      where: { candidateId },
      create: {
        candidateId,
        publicRepoCount: user.public_repos,
        followers: user.followers,
        activityLast90Days,
        languages,
        collectedAt: new Date(),
      },
      update: {
        publicRepoCount: user.public_repos,
        followers: user.followers,
        activityLast90Days,
        languages,
        collectedAt: new Date(),
      },
    });

    await prisma.externalAccount.update({
      where: { candidateId_provider: { candidateId, provider: "GITHUB" } },
      data: {
        status: "CONNECTED",
        externalUsername: username,
        unavailableReason: null,
        lastSyncedAt: new Date(),
      },
    });

    // Gatilho 2 (FR-034): GitHub sincronizado — recalcula o match com todas as vagas
    // publicadas. Fire-and-forget, não atrasa a resposta da sincronização.
    recomputeJobMatchesForCandidate(candidateId).catch(() => {});

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao coletar o GitHub";
    return fail(candidateId, message);
  }
}

async function fail(candidateId: string, reason: string): Promise<CollectResult> {
  await prisma.externalAccount.update({
    where: { candidateId_provider: { candidateId, provider: "GITHUB" } },
    data: { status: "UNAVAILABLE", unavailableReason: reason },
  });
  return { ok: false, reason };
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function aggregateLanguagesByBytes(repos: GithubRepo[]): Array<{ name: string; bytes: number; share: number }> {
  const byLanguage = new Map<string, number>();
  for (const repo of repos) {
    if (!repo.language) continue;
    byLanguage.set(repo.language, (byLanguage.get(repo.language) ?? 0) + repo.size);
  }
  const totalBytes = [...byLanguage.values()].reduce((sum, bytes) => sum + bytes, 0) || 1;
  return [...byLanguage.entries()]
    .map(([name, bytes]) => ({ name, bytes, share: Number((bytes / totalBytes).toFixed(2)) }))
    .sort((a, b) => b.bytes - a.bytes);
}
