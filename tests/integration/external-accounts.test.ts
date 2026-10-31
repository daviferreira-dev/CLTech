// RF02 / FR-010..013 — conectar GitHub e LinkedIn exige posse da conta via OAuth (Account).
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import {
  connectExternalAccount,
  disconnectExternalAccount,
  linkedInLinkMissing,
  recordOAuthIdentity,
  retrySync,
} from "@/server/candidates/external-accounts";
import { collectGithubProfile } from "@/server/integrations/github";

const GITHUB_ID = "583231"; // ID numérico da conta "octocat" na API falsa abaixo

async function candidate() {
  const user = await registerCandidate({ name: "Ana", email: `ana-${Date.now()}-${Math.random()}@example.com`, password: "senhaSegura123" });
  const { id: candidateId } = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id }, select: { id: true } });
  return { userId: user.id, candidateId };
}

/** Simula o vínculo OAuth que o Auth.js grava ao autorizar o provedor. */
function authorize(userId: string, provider: "github" | "linkedin", providerAccountId = provider === "github" ? GITHUB_ID : "li-sub-1") {
  return prisma.account.create({ data: { userId, type: provider === "github" ? "oauth" : "oidc", provider, providerAccountId } });
}

function account(candidateId: string, provider: "GITHUB" | "LINKEDIN") {
  return prisma.externalAccount.findUniqueOrThrow({ where: { candidateId_provider: { candidateId, provider } } });
}

// API do GitHub falsa para o arquivo todo (a coleta disparada sem await pode terminar
// depois do teste): /users/octocat existe, o resto dá 404.
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string) => {
    if (url.endsWith(`/user/${GITHUB_ID}`)) return json({ login: "octocat" });
    if (url.endsWith("/users/octocat")) return json({ public_repos: 2, followers: 5 });
    if (url.includes("/users/octocat/repos")) return json([{ language: "TypeScript", size: 300 }, { language: "Go", size: 100 }]);
    if (url.includes("/users/octocat/events")) return json([{}, {}, {}]);
    return json({ message: "Not Found" }, 404);
  }),
);
afterAll(() => {
  vi.unstubAllGlobals();
});

describe("conectar contas externas exige OAuth", () => {
  it("sem autorizar o provedor, GitHub e LinkedIn são recusados", async () => {
    const { userId } = await candidate();
    await expect(connectExternalAccount(userId, { provider: "GITHUB", url: "https://github.com/octocat" })).rejects.toMatchObject({
      status: 422,
      code: "OAUTH_REQUIRED",
    });
    await expect(connectExternalAccount(userId, { provider: "LINKEDIN", url: "https://linkedin.com/in/ana" })).rejects.toMatchObject({
      status: 422,
      code: "OAUTH_REQUIRED",
    });
  });

  it("GitHub: usuário vem da conta autorizada, não do link digitado", async () => {
    const { userId, candidateId } = await candidate();
    await authorize(userId, "github");
    const result = await connectExternalAccount(userId, { provider: "GITHUB", url: "https://github.com/outra-pessoa" });
    expect(result.status).toBe("PENDING");
    const linked = await account(candidateId, "GITHUB");
    expect(linked).toMatchObject({ externalUsername: "octocat", url: "https://github.com/octocat" });
    expect(linked.verifiedAt).not.toBeNull();

    await collectGithubProfile(candidateId, "octocat");
    expect(await account(candidateId, "GITHUB")).toMatchObject({ status: "CONNECTED" });
    expect(await prisma.githubProfile.findUniqueOrThrow({ where: { candidateId } })).toMatchObject({ publicRepoCount: 2, activityLast90Days: 3 });
  });

  it("LinkedIn: após autorizar, guarda o link validado como verificado", async () => {
    const { userId, candidateId } = await candidate();
    await authorize(userId, "linkedin");
    await recordOAuthIdentity(userId, "linkedin", "Ana Souza");
    const result = await connectExternalAccount(userId, { provider: "LINKEDIN", url: "br.linkedin.com/in/ana-souza/?trk=x" });
    expect(result.status).toBe("CONNECTED");
    const linked = await account(candidateId, "LINKEDIN");
    expect(linked).toMatchObject({ externalUsername: "ana-souza", url: "https://www.linkedin.com/in/ana-souza", verifiedName: "Ana Souza" });
    expect(linked.verifiedAt).not.toBeNull();
  });

  it("LinkedIn: link inválido é recusado mesmo autorizado", async () => {
    const { userId } = await candidate();
    await authorize(userId, "linkedin");
    await expect(connectExternalAccount(userId, { provider: "LINKEDIN", url: "https://linkedin.com/company/acme" })).rejects.toMatchObject({ status: 400 });
  });

  it("primeiro login com GitHub já conecta o portfólio; LinkedIn fica desconectado", async () => {
    const { userId, candidateId } = await candidate();
    await authorize(userId, "github");
    await authorize(userId, "linkedin");
    await recordOAuthIdentity(userId, "github", "octocat");
    await recordOAuthIdentity(userId, "linkedin", "Ana Souza");
    expect(await account(candidateId, "GITHUB")).toMatchObject({
      status: expect.stringMatching(/PENDING|CONNECTED/),
      externalUsername: "octocat",
      verifiedName: "octocat",
    });
    expect(await account(candidateId, "LINKEDIN")).toMatchObject({ status: "DISCONNECTED", verifiedName: "Ana Souza" });
  });

  it("login com LinkedIn pede o link do perfil uma vez só", async () => {
    const { userId } = await candidate();
    expect(await linkedInLinkMissing(userId)).toBe(false); // nunca entrou com LinkedIn
    await authorize(userId, "linkedin");
    await recordOAuthIdentity(userId, "linkedin", "Ana Souza");
    expect(await linkedInLinkMissing(userId)).toBe(true); // entrou, falta o link
    await connectExternalAccount(userId, { provider: "LINKEDIN", url: "https://www.linkedin.com/in/ana-souza" });
    expect(await linkedInLinkMissing(userId)).toBe(false);
    await disconnectExternalAccount(userId, "LINKEDIN");
    expect(await linkedInLinkMissing(userId)).toBe(false); // desconectou por escolha: não insiste
  });

  it("login com GitHub depois de desconectar não reconecta", async () => {
    const { userId, candidateId } = await candidate();
    await authorize(userId, "github");
    await recordOAuthIdentity(userId, "github", "octocat");
    // A coleta disparada no login termina antes de o candidato ir ao perfil desconectar.
    await vi.waitFor(async () => expect((await account(candidateId, "GITHUB")).status).toBe("CONNECTED"));
    await disconnectExternalAccount(userId, "GITHUB");
    await recordOAuthIdentity(userId, "github", "octocat");
    expect((await account(candidateId, "GITHUB")).status).toBe("DISCONNECTED");
  });

  it("desconectar o GitHub apaga o snapshot; retry não reativa vínculo desconectado", async () => {
    const { userId, candidateId } = await candidate();
    await authorize(userId, "github");
    await connectExternalAccount(userId, { provider: "GITHUB" });
    await collectGithubProfile(candidateId, "octocat");
    await disconnectExternalAccount(userId, "GITHUB");
    expect((await account(candidateId, "GITHUB")).status).toBe("DISCONNECTED");
    expect(await prisma.githubProfile.findUnique({ where: { candidateId } })).toBeNull();
    await expect(retrySync(userId, "GITHUB")).rejects.toMatchObject({ status: 404 });
  });
});
