// Bucket privado S3-compatível para currículos (Princípio I / FR-017 / R5).
// Nenhum arquivo é servido publicamente: toda leitura passa por URL assinada de
// curta duração, gerada apenas após a checagem de papel no chamador.

import { randomUUID } from "node:crypto";
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
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: storageKey });
  return getSignedUrl(getClient(), command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

/** Apaga objetos do bucket — usado na exclusão de conta (spec 006, FR-306). */
export async function deletePrivateObjects(storageKeys: string[]): Promise<void> {
  if (storageKeys.length === 0) return;
  await getClient().send(
    new DeleteObjectsCommand({
      Bucket: getBucket(),
      Delete: { Objects: storageKeys.map((Key) => ({ Key })), Quiet: true },
    }),
  );
}
