// Bucket privado S3-compatível para currículos (Princípio I / FR-017 / R5).
// Nenhum arquivo é servido publicamente: toda leitura passa por URL assinada de
// curta duração, gerada apenas após a checagem de papel no chamador.

import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
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

/** Faz upload de conteúdo já cifrado (R4) para o bucket privado. */
export async function uploadPrivateObject(
  candidateId: string,
  originalFilename: string,
  body: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const storageKey = `resumes/${candidateId}/${randomUUID()}-${sanitizeFilename(originalFilename)}`;

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

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}
