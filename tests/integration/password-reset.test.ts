// "Esqueci minha senha" e troca de senha: token só como hash, expira, uso único, pedido novo
// invalida o anterior, sem enumeração, rate limit e sessões antigas derrubadas.
import { createHash } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import type { ApiError } from "@/lib/errors";

const authMock = vi.fn();
vi.mock("@/server/auth/config", () => ({ auth: () => authMock() }));
const sendMail = vi.fn();
vi.mock("@/server/email/mailer", () => ({ sendMail: (m: unknown) => sendMail(m) }));

const { requestPasswordReset, resetPassword, changePassword } = await import("@/server/auth/password");
const { requireSession } = await import("@/server/auth/session");

const IP = "203.0.113.9";
const PASSWORD = "senhaNova123";

async function createUser(passwordHash: string | null = null) {
  return prisma.user.create({ data: { name: "Ana Souza", email: `ana-${Date.now()}-${Math.random()}@example.com`, passwordHash } });
}

/** Token que o e-mail levou, lido do texto puro da mensagem. */
function sentToken(): string {
  const text = (sendMail.mock.calls.at(-1)![0] as { text: string }).text;
  return new URL(text.match(/https?:\/\/\S+redefinir-senha\S+/)![0]).searchParams.get("token")!;
}

const status = (err: unknown) => (err as ApiError).status;
const code = (err: unknown) => (err as ApiError).code;

beforeEach(() => {
  sendMail.mockReset();
  authMock.mockReset();
});

describe("requestPasswordReset", () => {
  it("guarda só o SHA-256 do token, com validade de 1 hora", async () => {
    const user = await createUser();
    await requestPasswordReset({ email: user.email.toUpperCase() }, IP);

    const token = sentToken();
    const rows = await prisma.passwordResetToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    const ttl = rows[0]!.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(59 * 60_000);
    expect(ttl).toBeLessThanOrEqual(60 * 60_000);
  });

  it("e-mail inexistente responde igual e não manda nada", async () => {
    await expect(requestPasswordReset({ email: "ninguem@example.com" }, IP)).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("pedido novo invalida o anterior", async () => {
    const user = await createUser();
    await requestPasswordReset({ email: user.email }, IP);
    const first = sentToken();
    await requestPasswordReset({ email: user.email }, IP);

    await expect(resetPassword({ token: first, password: PASSWORD, confirm: PASSWORD }, IP)).rejects.toSatisfy((e) => code(e) === "RESET_TOKEN_INVALID");
    await expect(resetPassword({ token: sentToken(), password: PASSWORD, confirm: PASSWORD }, IP)).resolves.toBeTruthy();
  });

  it("limita os pedidos por e-mail, exista a conta ou não", async () => {
    for (let i = 0; i < 3; i++) await requestPasswordReset({ email: "x@example.com" }, IP);
    await expect(requestPasswordReset({ email: "x@example.com" }, IP)).rejects.toSatisfy((e) => status(e) === 429);
  });
});

describe("resetPassword", () => {
  it("troca a senha uma vez só e avisa por e-mail", async () => {
    const user = await createUser();
    await requestPasswordReset({ email: user.email }, IP);
    const token = sentToken();

    await resetPassword({ token, password: PASSWORD, confirm: PASSWORD }, IP);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await argon2.verify(updated.passwordHash!, PASSWORD)).toBe(true);
    expect(updated.passwordChangedAt).not.toBeNull();
    expect((sendMail.mock.calls.at(-1)![0] as { subject: string }).subject).toContain("foi alterada");

    await expect(resetPassword({ token, password: "outra12345", confirm: "outra12345" }, IP)).rejects.toSatisfy((e) => code(e) === "RESET_TOKEN_INVALID");
  });

  it("recusa token expirado", async () => {
    const user = await createUser();
    await requestPasswordReset({ email: user.email }, IP);
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(resetPassword({ token: sentToken(), password: PASSWORD, confirm: PASSWORD }, IP)).rejects.toSatisfy((e) => code(e) === "RESET_TOKEN_INVALID");
  });

  it("aplica a regra de senha do cadastro e exige as duas iguais", async () => {
    await expect(resetPassword({ token: "x", password: "curta", confirm: "curta" }, IP)).rejects.toThrow("ao menos 8");
    await expect(resetPassword({ token: "x", password: PASSWORD, confirm: "diferente1" }, IP)).rejects.toThrow("não são iguais");
  });

  it("limita as tentativas por IP", async () => {
    for (let i = 0; i < 20; i++) await resetPassword({ token: `chute-${i}`, password: PASSWORD, confirm: PASSWORD }, IP).catch(() => {});
    await expect(resetPassword({ token: "chute", password: PASSWORD, confirm: PASSWORD }, IP)).rejects.toSatisfy((e) => status(e) === 429);
  });

  it("define a primeira senha de conta criada só pelo GitHub", async () => {
    const user = await createUser(null);
    await requestPasswordReset({ email: user.email }, IP);
    await resetPassword({ token: sentToken(), password: PASSWORD, confirm: PASSWORD }, IP);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await argon2.verify(updated.passwordHash!, PASSWORD)).toBe(true);
  });
});

describe("changePassword", () => {
  it("exige a senha atual e troca", async () => {
    const user = await createUser(await argon2.hash("senhaAntiga1"));
    await expect(changePassword(user.id, { currentPassword: "errada", password: PASSWORD, confirm: PASSWORD })).rejects.toThrow("senha atual");
    await changePassword(user.id, { currentPassword: "senhaAntiga1", password: PASSWORD, confirm: PASSWORD });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await argon2.verify(updated.passwordHash!, PASSWORD)).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("conta sem senha é mandada para o esqueci minha senha", async () => {
    const user = await createUser(null);
    await expect(changePassword(user.id, { currentPassword: "x", password: PASSWORD, confirm: PASSWORD })).rejects.toSatisfy((e) => code(e) === "NO_PASSWORD");
  });
});

describe("sessões antigas caem depois da troca", () => {
  it("login anterior à troca vira 401; login posterior passa", async () => {
    const user = await createUser(await argon2.hash("senhaAntiga1"));
    authMock.mockResolvedValue({ user: { id: user.id, role: "CANDIDATE", authAt: Date.now() - 1000 } });
    await expect(requireSession()).resolves.toMatchObject({ id: user.id });

    await changePassword(user.id, { currentPassword: "senhaAntiga1", password: PASSWORD, confirm: PASSWORD });
    await expect(requireSession()).rejects.toSatisfy((e) => status(e) === 401);

    authMock.mockResolvedValue({ user: { id: user.id, role: "CANDIDATE", authAt: Date.now() + 1 } });
    await expect(requireSession()).resolves.not.toHaveProperty("passwordChangedAt");
  });

  it("token sem authAt (de antes deste recurso) cai se a senha já mudou", async () => {
    const user = await prisma.user.create({ data: { name: "B", email: `b-${Date.now()}@example.com`, passwordChangedAt: new Date() } });
    authMock.mockResolvedValue({ user: { id: user.id, role: "CANDIDATE" } });
    await expect(requireSession()).rejects.toSatisfy((e) => status(e) === 401);
  });
});
