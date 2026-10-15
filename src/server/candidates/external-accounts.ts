// RF02 / FR-010 / FR-012 / FR-013 — transições de estado em data-model.md:
// (inexistente) -> PENDING -> CONNECTED | UNAVAILABLE -> (sync) PENDING
// CONNECTED | UNAVAILABLE -> DISCONNECTED

import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { collectGithubProfile } from "@/server/integrations/github";
import type { ConnectExternalAccountInput } from "@/lib/validation/profile";

async function getCandidateIdForUser(userId: string): Promise<string> {
  const candidate = await prisma.candidate.findUnique({ where: { userId }, select: { id: true } });
  if (!candidate) throw Errors.notFound("Perfil");
  return candidate.id;
}

/**
 * Conecta uma conta externa. GitHub dispara coleta assíncrona (fire-and-forget,
 * R6): a rota retorna 202 PENDING antes da coleta terminar, o cliente faz poll
 * de GET /api/me/profile (contracts/api.md).
 */
export async function connectExternalAccount(
  userId: string,
  input: ConnectExternalAccountInput,
): Promise<{ status: "PENDING" }> {
  const candidateId = await getCandidateIdForUser(userId);

  await prisma.externalAccount.upsert({
    where: { candidateId_provider: { candidateId, provider: input.provider } },
    create: {
      candidateId,
      provider: input.provider,
      status: input.provider === "LATTES" ? "CONNECTED" : "PENDING",
      url: input.url,
      lastSyncedAt: input.provider === "LATTES" ? new Date() : null,
    },
    update: {
      status: input.provider === "LATTES" ? "CONNECTED" : "PENDING",
      url: input.url,
      unavailableReason: null,
    },
  });

  if (input.provider === "GITHUB") {
    // Fire-and-forget: a coleta não bloqueia a resposta (R6, RNF03).
    // Username: nesta sprint, assume-se a sessão OAuth do GitHub já vinculada
    // via Account (Auth.js); fallback para o nome informado em `url` como handle.
    const githubUsername = extractGithubUsername(input.url) ?? (await resolveGithubUsernameFromAccount(userId));
    if (githubUsername) {
      void collectGithubProfile(candidateId, githubUsername);
    } else {
      await prisma.externalAccount.update({
        where: { candidateId_provider: { candidateId, provider: "GITHUB" } },
        data: { status: "UNAVAILABLE", unavailableReason: "Usuário do GitHub não identificado" },
      });
    }
  }

  return { status: "PENDING" };
}

export async function disconnectExternalAccount(
  userId: string,
  provider: "GITHUB" | "LINKEDIN" | "LATTES",
): Promise<void> {
  const candidateId = await getCandidateIdForUser(userId);
  await prisma.externalAccount.update({
    where: { candidateId_provider: { candidateId, provider } },
    data: { status: "DISCONNECTED" },
  });
}

/** FR-013: nova tentativa de coleta para vínculo UNAVAILABLE. */
export async function retrySync(
  userId: string,
  provider: "GITHUB" | "LINKEDIN" | "LATTES",
): Promise<{ status: "PENDING" }> {
  const candidateId = await getCandidateIdForUser(userId);
  const account = await prisma.externalAccount.findUnique({
    where: { candidateId_provider: { candidateId, provider } },
  });
  if (!account) throw Errors.notFound("Conta externa");

  await prisma.externalAccount.update({
    where: { candidateId_provider: { candidateId, provider } },
    data: { status: "PENDING", unavailableReason: null },
  });

  if (provider === "GITHUB" && account.externalUsername) {
    void collectGithubProfile(candidateId, account.externalUsername);
  }

  return { status: "PENDING" };
}

function extractGithubUsername(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/github\.com\/([^/]+)/i);
  return match?.[1] ?? null;
}

async function resolveGithubUsernameFromAccount(userId: string): Promise<string | null> {
  // Account.providerAccountId do GitHub é o ID numérico, não o login. Resolver o
  // login exigiria uma chamada autenticada extra à API (GET /user com o access_token
  // salvo pelo adapter) — fora do escopo desta sprint. Nesta sprint, o candidato
  // informa a URL do perfil manualmente (coberto por `extractGithubUsername`).
  void userId;
  return null;
}
