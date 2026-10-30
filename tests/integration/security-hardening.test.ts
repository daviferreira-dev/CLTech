// Correções do relatorio-seguranca.md que dependem do banco: A2 (limite de tentativas),
// M2 (papel das páginas relido no banco) e M4 (re-cifragem com a chave nova).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { prisma } from "@/lib/prisma";

const authMock = vi.fn();
vi.mock("@/server/auth/config", () => ({ auth: () => authMock() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const { authorizeCredentials, TooManyAttempts } = await import("@/server/auth/credentials");
const { LIMITS, hit } = await import("@/server/auth/rate-limit");
const { requirePageRole } = await import("@/lib/guards");
const { encrypt, decrypt } = await import("@/server/crypto");
const { reencryptAll } = await import("@/server/reencrypt");

beforeEach(() => authMock.mockReset());
afterEach(() => vi.unstubAllEnvs());

async function recruiter() {
  return prisma.user.create({
    data: { name: "Rec", email: "rec@example.test", role: "RECRUITER", passwordHash: await argon2.hash("Senha123!") },
  });
}

describe("A2: limite de tentativas no login", () => {
  it("bloqueia o e-mail depois de 5 falhas, mesmo com a senha certa, e sem revelar se ele existe", async () => {
    await recruiter();
    for (let i = 0; i < 5; i++) expect(await authorizeCredentials({ email: "rec@example.test", password: "errada" }, "1.1.1.1")).toBeNull();
    await expect(authorizeCredentials({ email: "rec@example.test", password: "Senha123!" }, "2.2.2.2")).rejects.toBeInstanceOf(TooManyAttempts);

    for (let i = 0; i < 5; i++) await authorizeCredentials({ email: "ninguem@example.test", password: "x" }, "3.3.3.3");
    const err = await authorizeCredentials({ email: "ninguem@example.test", password: "x" }, "3.3.3.3").catch((e: unknown) => e);
    expect((err as { code: string }).code).toMatch(/^blocked_1[45]$/);
  });

  it("acerto zera o contador do e-mail; IP com muitas falhas fica bloqueado", async () => {
    await recruiter();
    for (let i = 0; i < 4; i++) await authorizeCredentials({ email: "rec@example.test", password: "errada" }, "4.4.4.4");
    expect(await authorizeCredentials({ email: "rec@example.test", password: "Senha123!" }, "4.4.4.4")).toMatchObject({ role: "RECRUITER" });
    expect(await prisma.rateLimit.findUnique({ where: { key: "login:email:rec@example.test" } })).toBeNull();

    for (let i = 0; i < 30; i++) await hit([LIMITS.loginIp("5.5.5.5")]);
    await expect(authorizeCredentials({ email: "rec@example.test", password: "Senha123!" }, "5.5.5.5")).rejects.toBeInstanceOf(TooManyAttempts);
  });

  it("cadastro: a 6ª tentativa no mesmo e-mail é recusada; janela vencida recomeça", async () => {
    const limit = LIMITS.registerEmail("novo@example.test");
    for (let i = 0; i < 5; i++) expect(await hit([limit])).toBeNull();
    expect(await hit([limit])).toBeInstanceOf(Date);

    await prisma.rateLimit.update({ where: { key: limit.key }, data: { resetAt: new Date(Date.now() - 1000) } });
    expect(await hit([limit])).toBeNull();
    expect(await prisma.rateLimit.findUnique({ where: { key: limit.key } })).toMatchObject({ count: 1 });
  });
});

describe("M2: requirePageRole relê o papel no banco", () => {
  it("recrutador rebaixado com JWT antigo cai fora de /recrutamento; excluído vai para o login", async () => {
    const user = await recruiter();
    authMock.mockResolvedValue({ user: { id: user.id, role: "RECRUITER" } });
    await expect(requirePageRole(["RECRUITER", "ADMIN"], "/recrutamento")).resolves.toMatchObject({ id: user.id });

    await prisma.user.update({ where: { id: user.id }, data: { role: "CANDIDATE" } });
    await expect(requirePageRole(["RECRUITER", "ADMIN"], "/recrutamento")).rejects.toThrow("redirect:/vagas");

    await prisma.user.delete({ where: { id: user.id } });
    await expect(requirePageRole(["RECRUITER", "ADMIN"], "/recrutamento")).rejects.toThrow("redirect:/entrar?callbackUrl=%2Frecrutamento");
  });
});

describe("M4: scripts/reencrypt.ts", () => {
  it("re-cifra o telefone com a chave nova e é idempotente", async () => {
    const oldKey = randomBytes(32).toString("base64");
    vi.stubEnv("ENCRYPTION_KEY", oldKey);
    const user = await prisma.user.create({ data: { name: "Cand", email: "cand@example.test" } });
    await prisma.candidate.create({ data: { userId: user.id, phone: encrypt("11 99999-0000") } });

    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    vi.stubEnv("ENCRYPTION_KEY_PREVIOUS", oldKey);
    expect(await reencryptAll()).toMatchObject({ phone: 1 });
    expect(await reencryptAll()).toMatchObject({ phone: 0 });

    vi.stubEnv("ENCRYPTION_KEY_PREVIOUS", "");
    const { phone } = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
    expect(decrypt(phone!)).toBe("11 99999-0000");
  });
});
