import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import { deletePrivateObjects, getPrivateObject, localObjectPath, uploadPrivateObject } from "@/server/storage";

// STORAGE_ENDPOINT="local" (dev): mesma interface do bucket, gravando em .storage/.
const BUCKET = "cltech-curriculos-unit-test";

beforeAll(() => {
  process.env.STORAGE_ENDPOINT = "local";
  process.env.STORAGE_BUCKET = BUCKET;
});

afterAll(async () => {
  await rm(path.resolve(".storage", BUCKET), { recursive: true, force: true });
});

describe("armazenamento local (dev)", () => {
  it("grava, lê e apaga", async () => {
    const { storageKey } = await uploadPrivateObject("cand-1", Buffer.from("conteudo"), "application/octet-stream");
    expect((await getPrivateObject(storageKey)).toString()).toBe("conteudo");

    await deletePrivateObjects([storageKey]);
    await expect(getPrivateObject(storageKey)).rejects.toThrow();
  });

  it("não deixa a chave escapar da pasta do bucket", () => {
    expect(() => localObjectPath("../../package.json")).toThrow();
    expect(() => localObjectPath("/etc/passwd")).toThrow();
  });

  it("é recusado na Vercel", async () => {
    process.env.VERCEL = "1";
    try {
      await expect(getPrivateObject("resumes/a/b")).rejects.toThrow(/Vercel/);
    } finally {
      delete process.env.VERCEL;
    }
  });
});
