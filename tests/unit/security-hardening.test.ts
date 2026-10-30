// Correções do relatorio-seguranca.md que não precisam de banco: A1, M1, M3, M4, B1, B3, B5.
import { afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { oauthEmailVerified } from "@/server/auth/oauth-email";
import { createHash } from "node:crypto";
import { THEME_SCRIPT, THEME_SCRIPT_HASH, contentSecurityPolicy } from "@/lib/csp";
import { localSandboxAllowed } from "@/server/sandbox";
import { decrypt, decryptRotating, encrypt } from "@/server/crypto";
import { authorizedCron } from "@/server/cron-auth";
import { meetingSchema } from "@/lib/validation/applications";
import { stageEmailSchema } from "@/lib/validation/jobs";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("A1: OAuth só com e-mail verificado", () => {
  const github = { provider: "github", access_token: "gho_x" };
  const emails = (list: unknown) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(list))));

  it("GitHub: aceita primário verificado igual ao do perfil", async () => {
    emails([{ email: "Rec@3aq.dev", primary: true, verified: true }]);
    expect(await oauthEmailVerified(github, { email: "rec@3aq.dev" })).toBe(true);
  });

  it("GitHub: recusa primário não verificado, sem token ou com a API fora", async () => {
    emails([{ email: "rec@3aq.dev", primary: true, verified: false }, { email: "outro@x.dev", primary: false, verified: true }]);
    expect(await oauthEmailVerified(github, { email: "rec@3aq.dev" })).toBe(false);
    expect(await oauthEmailVerified({ provider: "github" }, { email: "rec@3aq.dev" })).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    expect(await oauthEmailVerified(github, { email: "rec@3aq.dev" })).toBe(false);
  });

  it("LinkedIn: exige email_verified === true; credentials passa", async () => {
    expect(await oauthEmailVerified({ provider: "linkedin" }, { email: "a@b.dev", email_verified: true })).toBe(true);
    expect(await oauthEmailVerified({ provider: "linkedin" }, { email: "a@b.dev" })).toBe(false);
    expect(await oauthEmailVerified({ provider: "credentials" })).toBe(true);
  });
});

describe("M1: CSP", () => {
  it("produção: nonce, sem eval nem inline em script", () => {
    const csp = contentSecurityPolicy("abc", false);
    expect(csp).toContain(`script-src 'self' 'nonce-abc' '${THEME_SCRIPT_HASH}' 'strict-dynamic'`);
    expect(csp).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
  it("hash do script do tema bate com o script", () => {
    expect(THEME_SCRIPT_HASH).toBe(`sha256-${createHash("sha256").update(THEME_SCRIPT).digest("base64")}`);
  });
  it("dev libera eval e WebSocket do HMR", () => {
    expect(contentSecurityPolicy("abc", true)).toMatch(/'unsafe-eval'.*connect-src 'self' ws:/);
  });
});

describe("M3: sandbox local em produção", () => {
  it("só com opt-in explícito e nunca na Vercel", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(localSandboxAllowed({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(true);
    expect(localSandboxAllowed({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(false);
    expect(localSandboxAllowed({ NODE_ENV: "production", SANDBOX_ALLOW_LOCAL: "1", VERCEL: "1" } as NodeJS.ProcessEnv)).toBe(false);
    expect(localSandboxAllowed({ NODE_ENV: "production", SANDBOX_ALLOW_LOCAL: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("SEM isolamento"));
  });
});

describe("M4: rotação da ENCRYPTION_KEY", () => {
  it("decifra com a anterior e marca como stale; sem ela, falha", () => {
    const oldKey = randomBytes(32).toString("base64");
    vi.stubEnv("ENCRYPTION_KEY", oldKey);
    const old = encrypt("11 99999-0000");

    vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    expect(() => decrypt(old)).toThrow();
    vi.stubEnv("ENCRYPTION_KEY_PREVIOUS", oldKey);
    expect(decryptRotating(old)).toEqual({ plaintext: "11 99999-0000", stale: true });
    expect(decryptRotating(encrypt("novo"))).toEqual({ plaintext: "novo", stale: false });
  });
});

describe("B1: CRON_SECRET", () => {
  it("compara o Bearer inteiro", () => {
    expect(authorizedCron("Bearer s3cr3t", "s3cr3t")).toBe(true);
    expect(authorizedCron("Bearer s3cr3x", "s3cr3t")).toBe(false);
    expect(authorizedCron("Bearer s3cr3t", undefined)).toBe(false);
    expect(authorizedCron(null, "s3cr3t")).toBe(false);
  });
});

describe("B3 e B5: validação", () => {
  it("link da reunião só https", () => {
    const at = new Date().toISOString();
    expect(meetingSchema.safeParse({ scheduledAt: at, url: "http://meet.example.com/x" }).success).toBe(false);
    expect(meetingSchema.safeParse({ scheduledAt: at, url: "https://meet.example.com/x" }).success).toBe(true);
  });

  it("assunto do e-mail sem quebra de linha", () => {
    const stageId = crypto.randomUUID();
    const crlf = String.fromCharCode(13, 10);
    expect(stageEmailSchema.safeParse({ stageId, emailSubject: `Entrevista${crlf}Bcc: x@y.z` }).success).toBe(false);
    expect(stageEmailSchema.safeParse({ stageId, emailSubject: "Entrevista {{vaga}}" }).success).toBe(true);
    expect(stageEmailSchema.safeParse({ stageId, emailSubject: null }).success).toBe(true);
  });
});
