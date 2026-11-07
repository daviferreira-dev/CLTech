// Foto de perfil vinda do login social (src/server/auth/avatar.ts), chamada no callback jwt.
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createAdapter } from "@/server/auth/adapter";
import { safeAvatarUrl, syncOAuthAvatar } from "@/server/auth/avatar";
import { exportMyData } from "@/server/candidates/privacy";

const GH = "https://avatars.githubusercontent.com/u/583231?v=4";
const LI_OLD = "https://media.licdn.com/dms/image/v2/abc/profile-displayphoto?e=1&t=old";
const LI_NEW = "https://media.licdn.com/dms/image/v2/abc/profile-displayphoto?e=2&t=new";

const newUser = (email: string, image: string | null = null) =>
  prisma.user.create({ data: { email, name: "Ana", image, candidate: { create: {} } } });
const imageOf = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).image;

describe("foto de perfil do login social", () => {
  it("aceita só https dos hosts do GitHub e do LinkedIn", () => {
    expect(safeAvatarUrl(GH)).toBe(GH);
    expect(safeAvatarUrl(LI_NEW)).toBe(LI_NEW);
    expect(safeAvatarUrl("http://avatars.githubusercontent.com/u/1")).toBeNull();
    expect(safeAvatarUrl("https://evil.example/u/1.png")).toBeNull();
    expect(safeAvatarUrl("https://avatars.githubusercontent.com.evil.example/u/1")).toBeNull();
    expect(safeAvatarUrl("javascript:alert(1)")).toBeNull();
    expect(safeAvatarUrl(undefined)).toBeNull();
  });

  it("GitHub no primeiro login: o adapter cria sem foto e o jwt grava a do provedor", async () => {
    const adapter = createAdapter();
    const user = await adapter.createUser!({ id: crypto.randomUUID(), email: "octo@example.test", name: null, image: GH, emailVerified: null } as never);
    expect(await syncOAuthAvatar(user.id, GH)).toBe(GH);
    expect(await imageOf(user.id)).toBe(GH);
  });

  it("conta existente (e-mail e senha) sem foto ganha a do provedor ao vincular", async () => {
    const user = await newUser("ana@example.test");
    expect(await syncOAuthAvatar(user.id, LI_NEW)).toBe(LI_NEW);
    expect(await imageOf(user.id)).toBe(LI_NEW);
  });

  it("conta com foto não é sobrescrita por outro provedor nem por URL inválida", async () => {
    const user = await newUser("ana@example.test", GH);
    expect(await syncOAuthAvatar(user.id, LI_NEW)).toBe(GH);
    expect(await syncOAuthAvatar(user.id, "https://avatars.githubusercontent.com/u/999")).toBe(GH);
    expect(await syncOAuthAvatar(user.id, "https://evil.example/x.png")).toBe(GH);
    expect(await imageOf(user.id)).toBe(GH);
  });

  it("foto do LinkedIn (URL que expira) é renovada a cada login com LinkedIn", async () => {
    const user = await newUser("ana@example.test", LI_OLD);
    expect(await syncOAuthAvatar(user.id, LI_NEW)).toBe(LI_NEW);
    expect(await imageOf(user.id)).toBe(LI_NEW);
    // Login com GitHub não troca a foto do LinkedIn já gravada.
    expect(await syncOAuthAvatar(user.id, GH)).toBe(LI_NEW);
  });

  it("LGPD: a foto sai no exportar meus dados e some com a exclusão do User", async () => {
    const user = await newUser("ana@example.test", GH);
    expect((await exportMyData(user.id)).account.image).toBe(GH);
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.user.count({ where: { image: GH } })).toBe(0);
  });
});
