// Bucket privado S3-compatível para currículos (Princípio I / FR-017 / R5).
// Nenhum arquivo é servido publicamente: o conteúdo (cifrado) só sai do bucket pelo servidor,
// que confere o papel do solicitante e decifra antes de entregar.
//
// Desenvolvimento: STORAGE_ENDPOINT="local" grava numa pasta (.storage/) em vez do bucket, com
// a mesma interface. Recusado na Vercel, onde o disco é efêmero e o arquivo sumiria entre uma
// função e outra.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

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
  await putPrivateObject(storageKey, body, contentType);
  return { storageKey };
}

/** Grava (ou sobrescreve, na re-cifragem de scripts/reencrypt.ts) o objeto na chave dada. */
export async function putPrivateObject(storageKey: string, body: Buffer, contentType: string): Promise<void> {
  if (isLocalStorage()) {
    const file = localObjectPath(storageKey);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return;
  }

  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Lê o objeto do bucket (conteúdo como foi gravado, ainda cifrado). MUST ser chamada só
 * depois de verificar, no servidor, que o solicitante tem permissão (FR-017).
 */
export async function getPrivateObject(storageKey: string): Promise<Buffer> {
  if (isLocalStorage()) return readFile(localObjectPath(storageKey));
  const response = await getClient().send(new GetObjectCommand({ Bucket: getBucket(), Key: storageKey }));
  if (!response.Body) throw new Error(`Objeto vazio no bucket: ${storageKey}`);
  return Buffer.from(await response.Body.transformToByteArray());
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
