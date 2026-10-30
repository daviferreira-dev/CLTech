// Bucket privado S3-compatível para currículos (Princípio I / FR-017 / R5).
// Nenhum arquivo é servido publicamente: toda leitura passa por URL assinada de
// curta duração, gerada apenas após a checagem de papel no chamador.
//
// Desenvolvimento: STORAGE_ENDPOINT="local" grava numa pasta (.storage/) em vez do bucket, com
// a mesma interface — inclusive URL assinada, servida por /api/dev-storage. Recusado na Vercel,
// onde o disco é efêmero e o arquivo sumiria entre uma função e outra.

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const SIGNED_URL_TTL_SECONDS = 60;

function getClient(): S3Client {
  return new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: "auto",
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
      secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
    },
    forcePathStyle: true,
  });
}

function getBucket(): string {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_BUCKET não configurado");
  return bucket;
}

export function isLocalStorage(): boolean {
  if (process.env.STORAGE_ENDPOINT !== "local") return false;
  if (process.env.VERCEL) throw new Error('STORAGE_ENDPOINT="local" não funciona na Vercel (disco efêmero).');
  return true;
}

const LOCAL_ROOT = path.resolve(process.cwd(), ".storage");

/** Caminho do objeto na pasta local, recusando qualquer chave que escape dela. */
export function localObjectPath(storageKey: string): string {
  const root = path.join(LOCAL_ROOT, getBucket());
  const file = path.resolve(root, storageKey);
  if (!file.startsWith(root + path.sep)) throw new Error("Chave de armazenamento inválida.");
  return file;
}

function localSignature(storageKey: string, expires: number): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  return createHmac("sha256", secret).update(`${storageKey}\n${expires}`).digest();
}

/** Confere a assinatura e o prazo de uma URL gerada por getSignedDownloadUrl no modo local. */
export function verifyLocalSignature(storageKey: string, expires: number, signature: string): boolean {
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  const expected = localSignature(storageKey, expires);
  const given = Buffer.from(signature, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function readLocalObject(storageKey: string): Promise<Buffer> {
  return readFile(localObjectPath(storageKey));
}

export interface UploadResult {
  storageKey: string;
}

/**
 * Chave do objeto sem nenhum texto vindo do usuário (spec 006, FR-303 / L3): o nome do
 * arquivo costuma ser o nome da pessoa, e a chave aparece em log de acesso do provedor.
 * O nome original fica em Resume.originalFilename, atrás do controle de acesso.
 */
export function buildResumeStorageKey(candidateId: string): string {
  return `resumes/${candidateId}/${randomUUID()}`;
}

/** Faz upload de conteúdo já cifrado (R4) para o bucket privado. */
export async function uploadPrivateObject(
  candidateId: string,
  body: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const storageKey = buildResumeStorageKey(candidateId);

  if (isLocalStorage()) {
    const file = localObjectPath(storageKey);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { storageKey };
  }

  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { storageKey };
}

/**
 * Gera URL assinada de curta duração para download. MUST ser chamada só depois
 * de verificar, no servidor, que o solicitante tem permissão (FR-017).
 */
export async function getSignedDownloadUrl(storageKey: string): Promise<string> {
  if (isLocalStorage()) {
    const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
    const query = new URLSearchParams({
      key: storageKey,
      expires: String(expires),
      signature: localSignature(storageKey, expires).toString("base64url"),
    });
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    return new URL(`/api/dev-storage?${query}`, base).toString();
  }
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: storageKey });
  return getSignedUrl(getClient(), command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

/** Apaga objetos do bucket — usado na exclusão de conta (spec 006, FR-306). */
export async function deletePrivateObjects(storageKeys: string[]): Promise<void> {
  if (storageKeys.length === 0) return;
  if (isLocalStorage()) {
    await Promise.all(storageKeys.map((key) => rm(localObjectPath(key), { force: true })));
    return;
  }
  await getClient().send(
    new DeleteObjectsCommand({
      Bucket: getBucket(),
      Delete: { Objects: storageKeys.map((Key) => ({ Key })), Quiet: true },
    }),
  );
}
