// Sessão "jwt" (config.ts) sobrevive à exclusão do usuário: o cookie continua válido
// criptograficamente depois que a linha some do banco. Antes, isso só estourava no INSERT,
// como violação de chave estrangeira (500). Tem de virar 401.
//
// O papel também precisa vir do banco, não do token: FR-008 exige verificar a permissão no
// servidor a cada acesso, e um JWT emitido antes de uma mudança de papel carrega o antigo.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";

const authMock = vi.fn();
vi.mock("@/server/auth/config", () => ({ auth: () => authMock() }));

const { requireSession, requireRole } = await import("@/server/auth/session");

async function createUser(role: "CANDIDATE" | "RECRUITER" | "ADMIN" = "RECRUITER") {
  return prisma.user.create({
    data: { name: "Fulano", email: `sessao-${Date.now()}-${Math.random()}@example.com`, role },
  });
}

/** Simula o cookie: id e papel vindos do token, sem consultar o banco. */
function signedInAs(id: string, role = "RECRUITER") {
  authMock.mockResolvedValue({ user: { id, role, name: "Fulano", email: "x@example.com" } });
}

beforeEach(() => authMock.mockReset());

describe("requireSession com sessão órfã", () => {
  it("devolve 401 quando o usuário do token não existe mais", async () => {
    const user = await createUser();
    signedInAs(user.id);
    await prisma.user.delete({ where: { id: user.id } });

    await expect(requireSession()).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).status).toBe(401);
      expect((err as ApiError).code).toBe("UNAUTHENTICATED");
      return true;
    });
  });

  it("devolve 401 quando o token não traz id", async () => {
    authMock.mockResolvedValue({ user: { role: "RECRUITER" } });
    await expect(requireSession()).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).status).toBe(401);
      return true;
    });
  });

  it("devolve 401 quando não há sessão nenhuma", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireSession()).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).status).toBe(401);
      return true;
    });
  });

  it("passa normalmente quando o usuário existe", async () => {
    const user = await createUser();
    signedInAs(user.id);

    const authed = await requireSession();
    expect(authed.id).toBe(user.id);
    expect(authed.role).toBe("RECRUITER");
  });
});

describe("requireRole lê o papel do banco, não do token (FR-008)", () => {
  it("recusa quando o token diz RECRUITER mas o banco diz CANDIDATE", async () => {
    const user = await createUser("CANDIDATE");
    signedInAs(user.id, "RECRUITER"); // token obsoleto, emitido antes da mudança

    await expect(requireRole(["RECRUITER", "ADMIN"])).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).status).toBe(403);
      return true;
    });
  });

  it("aceita quando o papel do banco está entre os permitidos", async () => {
    const user = await createUser("ADMIN");
    signedInAs(user.id, "CANDIDATE"); // token desatualizado para menos, também corrigido

    const authed = await requireRole(["RECRUITER", "ADMIN"]);
    expect(authed.role).toBe("ADMIN");
  });
});
