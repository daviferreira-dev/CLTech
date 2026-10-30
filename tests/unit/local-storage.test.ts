import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  deletePrivateObjects,
  getSignedDownloadUrl,
  localObjectPath,
  readLocalObject,
  uploadPrivateObject,
  verifyLocalSignature,
} from "@/server/storage";

// STORAGE_ENDPOINT="local" (dev): mesma interface do bucket, gravando em .storage/.
const BUCKET = "cltech-curriculos-unit-test";

beforeAll(() => {
  process.env.STORAGE_ENDPOINT = "local";
  process.env.STORAGE_BUCKET = BUCKET;
  process.env.AUTH_SECRET = "unit-test-secret";
  process.env.NEXTAUTH_URL = "http://localhost:3000";
});

afterAll(async () => {
  await rm(path.resolve(".storage", BUCKET), { recursive: true, force: true });
});

function signedParams(url: string) {
  const params = new URL(url).searchParams;
  return { key: params.get("key")!, expires: Number(params.get("expires")), signature: params.get("signature")! };
}

describe("armazenamento local (dev)", () => {
  it("grava, gera URL assinada, lê e apaga", async () => {
    const { storageKey } = await uploadPrivateObject("cand-1", Buffer.from("conteudo"), "application/octet-stream");
    expect((await readLocalObject(storageKey)).toString()).toBe("conteudo");

    const url = await getSignedDownloadUrl(storageKey);
    expect(url.startsWith("http://localhost:3000/api/dev-storage?")).toBe(true);
    const { key, expires, signature } = signedParams(url);
    expect(verifyLocalSignature(key, expires, signature)).toBe(true);

    await deletePrivateObjects([storageKey]);
    await expect(readLocalObject(storageKey)).rejects.toThrow();
  });

  it("recusa assinatura de outra chave, adulterada ou vencida", async () => {
    const { key, expires, signature } = signedParams(await getSignedDownloadUrl("resumes/a/b"));
    expect(verifyLocalSignature("resumes/a/outro", expires, signature)).toBe(false);
    expect(verifyLocalSignature(key, expires + 1, signature)).toBe(false);
    expect(verifyLocalSignature(key, Math.floor(Date.now() / 1000) - 1, signature)).toBe(false);
    expect(verifyLocalSignature(key, expires, "")).toBe(false);
  });

  it("não deixa a chave escapar da pasta do bucket", () => {
    expect(() => localObjectPath("../../package.json")).toThrow();
    expect(() => localObjectPath("/etc/passwd")).toThrow();
  });

  it("é recusado na Vercel", async () => {
    process.env.VERCEL = "1";
    try {
      await expect(getSignedDownloadUrl("resumes/a/b")).rejects.toThrow(/Vercel/);
    } finally {
      delete process.env.VERCEL;
    }
  });
});
