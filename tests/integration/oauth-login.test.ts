// Primeiro login social e vínculo por e-mail, chamando o adapter na mesma ordem que o
// Auth.js (handleLoginOrRegister em @auth/core): getUserByAccount → getUserByEmail →
// createUser (só se não achou) → linkAccount; depois o callback jwt grava a identidade.
import { afterAll, describe, expect, it, vi } from "vitest";
import type { AdapterAccount, AdapterUser } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";
import { createAdapter } from "@/server/auth/adapter";
import { recordOAuthIdentity } from "@/server/candidates/external-accounts";

const adapter = createAdapter();

// O primeiro login com GitHub conecta o portfólio: API do GitHub falsa para a conta 583231.
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string) => (url.endsWith("/user/583231") ? json({ login: "octocat" }) : json({ message: "Not Found" }, 404))),
);
afterAll(() => {
  vi.unstubAllGlobals();
});

type Profile = { email: string; name: string | null; image: string | null; login?: string };

async function oauthLogin(provider: "github" | "linkedin", providerAccountId: string, profile: Profile) {
  const account: AdapterAccount = {
    provider,
    providerAccountId,
    type: provider === "github" ? "oauth" : "oidc",
    userId: "",
    access_token: "gho_token-que-nao-pode-ser-gravado",
    refresh_token: "refresh-que-nao-pode-ser-gravado",
    id_token: "id-token-que-nao-pode-ser-gravado",
    token_type: "bearer",
    scope: "read:user user:email",
    expires_at: 9999999999,
  };
  let user: AdapterUser | null = await adapter.getUserByAccount!({ provider, providerAccountId });
  if (!user) {
    // allowDangerousEmailAccountLinking: e-mail igual liga à conta existente.
    user =
      (await adapter.getUserByEmail!(profile.email)) ??
      (await adapter.createUser!({ id: crypto.randomUUID(), email: profile.email, name: profile.name, image: profile.image, emailVerified: null } as AdapterUser));
    await adapter.linkAccount!({ ...account, userId: user.id });
  }
  await recordOAuthIdentity(user.id, provider, profile.name ?? profile.login);
  return user;
}

describe("primeiro login social e vínculo de contas (FR-003)", () => {
  it("GitHub novo com image e name nulo cria User + Candidate; LinkedIn com o mesmo e-mail liga ao mesmo usuário", async () => {
    // (a) regressão: `image` não existe em User e `name` nulo quebrava o createUser.
    const github = await oauthLogin("github", "583231", {
      email: "octo@example.test",
      name: null,
      image: "https://avatars.githubusercontent.com/u/583231",
      login: "octocat",
    });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: github.id } });
    expect(stored).toMatchObject({ email: "octo@example.test", name: "octo", role: "CANDIDATE" });
    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: github.id } });

    // (b) nenhum token do provedor vai para o banco.
    const ghAccount = await prisma.account.findFirstOrThrow({ where: { provider: "github" } });
    expect(ghAccount).toMatchObject({ userId: github.id, providerAccountId: "583231", access_token: null, refresh_token: null, id_token: null });

    // (c) LinkedIn com o mesmo e-mail: mesmo User, sem segundo Candidate.
    const linkedin = await oauthLogin("linkedin", "li-sub-1", { email: "octo@example.test", name: "Octo Cat", image: null });
    expect(linkedin.id).toBe(github.id);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.candidate.count()).toBe(1);
    expect(await prisma.account.count({ where: { userId: github.id } })).toBe(2);
    expect(await prisma.account.findFirstOrThrow({ where: { provider: "linkedin" } })).toMatchObject({ access_token: null, id_token: null });

    // (d) GitHub já sai conectado (coleta em andamento, login como nome quando name é nulo);
    // LinkedIn fica DISCONNECTED com o nome verificado, porque o OIDC não traz o link do perfil.
    const external = await prisma.externalAccount.findMany({ where: { candidateId: candidate.id }, orderBy: { provider: "asc" } });
    expect(external).toMatchObject([
      { provider: "GITHUB", status: expect.stringMatching(/PENDING|CONNECTED|UNAVAILABLE/), externalUsername: "octocat", verifiedName: "octocat" },
      { provider: "LINKEDIN", status: "DISCONNECTED", verifiedName: "Octo Cat" },
    ]);

    // Segundo login do GitHub acha pela conta e não cria nada novo.
    expect((await oauthLogin("github", "583231", { email: "octo@example.test", name: null, image: null, login: "octocat" })).id).toBe(github.id);
    expect(await prisma.user.count()).toBe(1);
  });
});
