// RF02 / FR-010 / FR-012 / FR-013 — transições de estado em data-model.md:
// (inexistente) -> PENDING -> CONNECTED | UNAVAILABLE -> (sync) PENDING
// CONNECTED | UNAVAILABLE -> DISCONNECTED
//
// Posse da conta comprovada por OAuth (Auth.js vincula o provedor ao usuário logado, tabela
// Account) — digitar o perfil de outra pessoa não basta:
// - GitHub: o usuário sai do ID da conta autorizada; coleta da API pública (integrations/github.ts).
// - LinkedIn: o OIDC não devolve o link público do perfil, então o candidato informa o link
//   depois de autorizar; o recrutador vê o nome verificado pelo LinkedIn ao lado.
// - Lattes: sem OAuth — link validado, marcado como não verificado.

import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { collectGithubProfile, resolveGithubLogin } from "@/server/integrations/github";
import { recomputeJobMatchesForCandidate } from "@/server/matching/recompute";
import type { ConnectExternalAccountInput } from "@/lib/validation/profile";
import { parseGithubProfile, parseLattesProfile, parseLinkedinProfile, type ParsedExternalProfile } from "@/lib/external-profiles";
import { keepAlive } from "@/server/background";

type Provider = "GITHUB" | "LINKEDIN" | "LATTES";

/** Nome do provedor na tabela Account (Auth.js). */
const OAUTH_PROVIDER: Partial<Record<Provider, string>> = { GITHUB: "github", LINKEDIN: "linkedin" };

const INVALID_MESSAGE: Record<"LINKEDIN" | "LATTES", string> = {
  LINKEDIN: "Informe o link do seu perfil do LinkedIn (ex.: https://www.linkedin.com/in/seu-perfil).",
  LATTES: "Informe o link do seu currículo Lattes (ex.: http://lattes.cnpq.br/0000000000000000).",
};

const PARSERS: Record<"LINKEDIN" | "LATTES", (input: string) => ParsedExternalProfile | null> = {
  LINKEDIN: parseLinkedinProfile,
  LATTES: parseLattesProfile,
};

async function getCandidateIdForUser(userId: string): Promise<string> {
  const candidate = await prisma.candidate.findUnique({ where: { userId }, select: { id: true } });
  if (!candidate) throw Errors.notFound("Perfil");
  return candidate.id;
}

/**
 * Conecta uma conta externa. GitHub dispara coleta assíncrona (fire-and-forget,
 * R6): a rota retorna 202 PENDING antes da coleta terminar, o cliente faz poll
 * de GET /api/me/profile (contracts/api.md). LinkedIn e Lattes já voltam CONNECTED.
 */
export async function connectExternalAccount(
  userId: string,
  input: ConnectExternalAccountInput,
): Promise<{ status: "PENDING" | "CONNECTED" }> {
  const candidateId = await getCandidateIdForUser(userId);

  const oauthProvider = OAUTH_PROVIDER[input.provider];
  const oauthAccount = oauthProvider
    ? await prisma.account.findFirst({ where: { userId, provider: oauthProvider }, select: { providerAccountId: true } })
    : null;
  if (oauthProvider && !oauthAccount) {
    throw Errors.businessRule("OAUTH_REQUIRED", "Autorize o acesso à sua conta para conectá-la.");
  }

  let profile: ParsedExternalProfile | null;
  if (input.provider === "GITHUB") {
    // O usuário vem só da conta autorizada; `url` enviada é ignorada.
    const login = await resolveGithubLogin(oauthAccount!.providerAccountId);
    profile = login ? parseGithubProfile(login) : null;
    if (!profile) throw Errors.businessRule("GITHUB_UNRESOLVED", "Não foi possível identificar seu usuário do GitHub. Tente de novo em instantes.");
  } else {
    profile = input.url ? PARSERS[input.provider](input.url) : null;
    if (!profile) throw Errors.validation(INVALID_MESSAGE[input.provider]);
  }

  const status = input.provider === "GITHUB" ? "PENDING" : "CONNECTED";
  const data = {
    status,
    externalUsername: profile.username,
    url: profile.url,
    unavailableReason: null,
    lastSyncedAt: status === "CONNECTED" ? new Date() : null,
    verifiedAt: oauthAccount ? new Date() : null,
  } as const;

  await prisma.externalAccount.upsert({
    where: { candidateId_provider: { candidateId, provider: input.provider } },
    create: { candidateId, provider: input.provider, ...data },
    update: data,
  });

  // Fire-and-forget: a coleta não bloqueia a resposta (R6, RNF03).
  if (input.provider === "GITHUB") keepAlive(collectGithubProfile(candidateId, profile.username));

  return { status };
}

/**
 * Chamado no callback `jwt` a cada login/vínculo OAuth: guarda o nome que o provedor
 * devolveu, exibido ao recrutador como "verificado". Cria o vínculo como DISCONNECTED se
 * ainda não existir — ele só fica CONNECTED pelo `connectExternalAccount`.
 */
export async function recordOAuthIdentity(userId: string, oauthProvider: string, name: string | null | undefined): Promise<void> {
  const provider = (Object.keys(OAUTH_PROVIDER) as Provider[]).find((p) => OAUTH_PROVIDER[p] === oauthProvider);
  if (!provider || !name) return;
  const candidate = await prisma.candidate.findUnique({ where: { userId }, select: { id: true } });
  if (!candidate) return;
  await prisma.externalAccount.upsert({
    where: { candidateId_provider: { candidateId: candidate.id, provider } },
    create: { candidateId: candidate.id, provider, status: "DISCONNECTED", verifiedName: name },
    update: { verifiedName: name },
  });
}

export async function disconnectExternalAccount(userId: string, provider: Provider): Promise<void> {
  const candidateId = await getCandidateIdForUser(userId);
  await prisma.externalAccount.update({
    where: { candidateId_provider: { candidateId, provider } },
    data: { status: "DISCONNECTED" },
  });

  // Dado coletado de vínculo desfeito não pode seguir alimentando o match (LGPD, finalidade).
  if (provider === "GITHUB") {
    const { count } = await prisma.githubProfile.deleteMany({ where: { candidateId } });
    if (count > 0) keepAlive(recomputeJobMatchesForCandidate(candidateId).catch(() => {}));
  }
}

/** FR-013: nova tentativa de coleta para vínculo UNAVAILABLE. */
export async function retrySync(userId: string, provider: Provider): Promise<{ status: "PENDING" | "CONNECTED" | "UNAVAILABLE" }> {
  const candidateId = await getCandidateIdForUser(userId);
  const account = await prisma.externalAccount.findUnique({
    where: { candidateId_provider: { candidateId, provider } },
  });
  // Vínculo desconectado só volta pelo fluxo de conexão (que exige o OAuth de novo).
  if (!account || account.status === "DISCONNECTED") throw Errors.notFound("Conta externa", true);

  const where = { candidateId_provider: { candidateId, provider } };

  if (!account.externalUsername) {
    await prisma.externalAccount.update({
      where,
      data: { status: "UNAVAILABLE", unavailableReason: "Perfil não informado. Desconecte e conecte novamente." },
    });
    return { status: "UNAVAILABLE" };
  }

  if (provider !== "GITHUB") {
    await prisma.externalAccount.update({
      where,
      data: { status: "CONNECTED", unavailableReason: null, lastSyncedAt: new Date() },
    });
    return { status: "CONNECTED" };
  }

  await prisma.externalAccount.update({ where, data: { status: "PENDING", unavailableReason: null } });
  keepAlive(collectGithubProfile(candidateId, account.externalUsername));
  return { status: "PENDING" };
}
