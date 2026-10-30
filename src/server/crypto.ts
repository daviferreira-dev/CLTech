// AES-256-GCM para dados pessoais em repouso (Princípio I / FR-016 / R4).
//
// Formato do ciphertext: "v1:<ivBase64>:<authTagBase64>:<cipherBase64>".
// O prefixo de versão existe para permitir rotação de chave sem migração
// destrutiva — ver research.md R4.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12; // recomendado para GCM

function parseKey(name: string, base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error(`${name} deve ter 32 bytes (256 bits) em base64`);
  }
  return key;
}

function getKey(): Buffer {
  const base64Key = process.env.ENCRYPTION_KEY;
  if (!base64Key) {
    throw new Error("ENCRYPTION_KEY não configurada — gere com: openssl rand -base64 32");
  }
  return parseKey("ENCRYPTION_KEY", base64Key);
}

/** M4: durante a rotação, a chave antiga só decifra (scripts/reencrypt.ts re-cifra com a atual). */
function getPreviousKey(): Buffer | null {
  const base64Key = process.env.ENCRYPTION_KEY_PREVIOUS;
  return base64Key ? parseKey("ENCRYPTION_KEY_PREVIOUS", base64Key) : null;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

function decryptWith(key: Buffer, ivB64: string, authTagB64: string, dataB64: string): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

function parts(ciphertext: string): [string, string, string] {
  const parts = ciphertext.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Formato de ciphertext inválido ou versão de chave não suportada");
  }
  return [parts[1]!, parts[2]!, parts[3]!];
}

export function decrypt(ciphertext: string): string {
  return decryptRotating(ciphertext).plaintext;
}

/** Tenta a chave atual e, se falhar a autenticação, a anterior. `stale` = cifrado com a anterior. */
export function decryptRotating(ciphertext: string): { plaintext: string; stale: boolean } {
  const fields = parts(ciphertext);
  try {
    return { plaintext: decryptWith(getKey(), ...fields), stale: false };
  } catch (err) {
    const previous = getPreviousKey();
    if (!previous) throw err;
    return { plaintext: decryptWith(previous, ...fields), stale: true };
  }
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
