// Spec 006, US2 — CT-RNF05 passo 3 / RN004: negação de acesso provada por matriz.
//
// A matriz não é escrita à mão: o teste varre os arquivos route.ts em disco e chama cada
// método exportado. Uma rota nova em api/recruiter ou api/me sem guarda quebra a suíte
// (SC-302) sem que ninguém precise lembrar de acrescentá-la aqui.
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

const authMock = vi.fn();
vi.mock("@/server/auth/config", () => ({ auth: () => authMock() }));

type Role = "CANDIDATE" | "RECRUITER" | "ADMIN";
type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const API_ROOT = path.resolve(__dirname, "../../src/app/api");

/** Rotas exclusivas de ADMIN — recrutador também precisa levar 403 nelas. */
const ADMIN_ONLY = new Set(["POST recruiter/challenges", "PATCH recruiter/challenges/[id]"]);

function routeFiles(area: string): string[] {
  return (readdirSync(path.join(API_ROOT, area), { recursive: true }) as string[])
    .filter((file) => path.basename(file) === "route.ts")
    .map((file) => path.join(area, path.dirname(file)).split(path.sep).join("/"));
}

async function handlersOf(route: string): Promise<[string, Handler][]> {
  const mod = (await import(pathToFileURL(path.join(API_ROOT, route, "route.ts")).href)) as Record<string, unknown>;
  return METHODS.filter((m) => typeof mod[m] === "function").map((m) => [m, mod[m] as Handler]);
}

async function call(route: string, method: string, handler: Handler): Promise<number> {
  const url = `http://localhost/api/${route.replace(/\[[^\]]+\]/g, "00000000-0000-0000-0000-000000000000")}`;
  const init: { method: string; body?: string; headers?: Record<string, string> } = { method };
  if (method !== "GET" && method !== "DELETE") {
    init.body = "{}";
    init.headers = { "content-type": "application/json" };
  }
  const params = { id: "00000000-0000-0000-0000-000000000000", provider: "github" };
  const { NextRequest } = await import("next/server");
  const res = await handler(new NextRequest(url, init), { params: Promise.resolve(params) });
  return res.status;
}

async function signIn(role: Role | null) {
  if (!role) {
    authMock.mockResolvedValue(null);
    return;
  }
  const user = await prisma.user.create({
    data: { name: "Matriz", email: `matriz-${role}-${Date.now()}-${Math.random()}@example.com`, role },
  });
  authMock.mockResolvedValue({ user: { id: user.id, role, name: user.name, email: user.email } });
}

beforeEach(() => authMock.mockReset());

describe("matriz de acesso — api/recruiter (RN004)", () => {
  const routes = routeFiles("recruiter");

  it("encontra as rotas em disco", () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
  });

  it.each(routes)("%s: visitante 401, candidato 403", async (route) => {
    for (const [method, handler] of await handlersOf(route)) {
      await signIn(null);
      expect(await call(route, method, handler), `${method} ${route} sem sessão`).toBe(401);
      await signIn("CANDIDATE");
      expect(await call(route, method, handler), `${method} ${route} como candidato`).toBe(403);
      if (ADMIN_ONLY.has(`${method} ${route}`)) {
        await signIn("RECRUITER");
        expect(await call(route, method, handler), `${method} ${route} como recrutador`).toBe(403);
      }
    }
  });
});

describe("matriz de acesso — api/me (dados do titular)", () => {
  const routes = routeFiles("me");

  it.each(routes)("%s: visitante 401, recrutador 403", async (route) => {
    for (const [method, handler] of await handlersOf(route)) {
      await signIn(null);
      expect(await call(route, method, handler), `${method} ${route} sem sessão`).toBe(401);
      await signIn("RECRUITER");
      expect(await call(route, method, handler), `${method} ${route} como recrutador`).toBe(403);
    }
  });
});

describe("rota interna de expiração", () => {
  it("recusa chamada sem CRON_SECRET", async () => {
    const [[method, handler]] = (await handlersOf("internal/code-tests/expire")) as [[string, Handler]];
    expect(await call("internal/code-tests/expire", method, handler)).toBe(401);
  });
});
