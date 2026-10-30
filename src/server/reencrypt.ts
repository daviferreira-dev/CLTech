// M4: re-cifra com a ENCRYPTION_KEY atual tudo o que ainda está com a ENCRYPTION_KEY_PREVIOUS.
// Idempotente: valor que já decifra com a chave atual fica como está. Rodar via scripts/reencrypt.ts.
import { prisma } from "@/lib/prisma";
import { decryptRotating, encrypt } from "@/server/crypto";
import { getPrivateObject, putPrivateObject } from "@/server/storage";

/** Novo ciphertext se o valor estava com a chave anterior; null se já está com a atual. */
function rotate(ciphertext: string | null): string | null {
  if (!ciphertext) return null;
  const { plaintext, stale } = decryptRotating(ciphertext);
  return stale ? encrypt(plaintext) : null;
}

export async function reencryptAll(): Promise<Record<string, number>> {
  const counts = { phone: 0, resumeText: 0, resumeFile: 0, draft: 0, submission: 0 };

  for (const c of await prisma.candidate.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } })) {
    const phone = rotate(c.phone);
    if (phone) counts.phone += (await prisma.candidate.update({ where: { id: c.id }, data: { phone } }), 1);
  }

  for (const r of await prisma.resume.findMany({ select: { id: true, storageKey: true, mimeType: true, extractedText: true } })) {
    const extractedText = rotate(r.extractedText);
    if (extractedText) counts.resumeText += (await prisma.resume.update({ where: { id: r.id }, data: { extractedText } }), 1);
    // O arquivo some do bucket quando a conta é excluída; o que não existe mais fica de fora.
    const stored = await getPrivateObject(r.storageKey).catch(() => null);
    const file = stored && rotate(stored.toString("utf8"));
    if (file) counts.resumeFile += (await putPrivateObject(r.storageKey, Buffer.from(file, "utf8"), r.mimeType), 1);
  }

  for (const d of await prisma.codeDraft.findMany({ select: { id: true, sourceCode: true } })) {
    const sourceCode = rotate(d.sourceCode);
    if (sourceCode) counts.draft += (await prisma.codeDraft.update({ where: { id: d.id }, data: { sourceCode } }), 1);
  }

  for (const s of await prisma.codeSubmission.findMany({ select: { id: true, sourceCode: true } })) {
    const sourceCode = rotate(s.sourceCode);
    if (sourceCode) counts.submission += (await prisma.codeSubmission.update({ where: { id: s.id }, data: { sourceCode } }), 1);
  }

  return counts;
}
