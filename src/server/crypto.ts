// AES-256-GCM para dados pessoais em repouso (Princípio I / FR-016 / R4).
//
// Formato do ciphertext: "v1:<ivBase64>:<authTagBase64>:<cipherBase64>".
// O prefixo de versão existe para permitir rotação de chave sem migração
// destrutiva — ver research.md R4.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12; // recomendado para GCM

function getKey(): Buffer {
  const base64Key = process.env.ENCRYPTION_KEY;
  if (!base64Key) {
    throw new Error("ENCRYPTION_KEY não configurada — gere com: openssl rand -base64 32");
  }
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY deve ter 32 bytes (256 bits) em base64");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Formato de ciphertext inválido ou versão de chave não suportada");
  }
  const [, ivB64, authTagB64, dataB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64 as string, "base64");
  const authTag = Buffer.from(authTagB64 as string, "base64");
  const data = Buffer.from(dataB64 as string, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Decifra apenas se o valor existir; útil para campos opcionais como Candidate.phone. */
export function decryptOrNull(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  return decrypt(ciphertext);
}

/** Cifra apenas se o valor existir; evita gravar "v1:::" para campo vazio. */
export function encryptOrNull(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  return encrypt(plaintext);
}
