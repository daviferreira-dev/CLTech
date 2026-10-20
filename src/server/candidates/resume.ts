// RF02 / FR-014 / FR-015 / FR-016 / R5 — validação de servidor é a autoridade:
// extensão e MIME são falsificáveis, magic number não.

import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { uploadPrivateObject } from "@/server/storage";
import { encrypt, encryptOrNull } from "@/server/crypto";
import { MAX_RESUME_SIZE_BYTES, ALLOWED_RESUME_MIME_TYPES } from "@/lib/validation/profile";
import { extractText } from "@/server/matching/text-extract";
import { recomputeJobMatchesForCandidate } from "@/server/matching/recompute";

const PDF_MAGIC = Buffer.from("%PDF");
const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04 (zip, base do .docx)

function detectRealMimeType(buffer: Buffer): string | null {
  if (buffer.subarray(0, 4).equals(PDF_MAGIC)) return "application/pdf";
  if (buffer.subarray(0, 4).equals(DOCX_MAGIC)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

export interface UploadResumeResult {
  id: string;
  originalFilename: string;
  sizeBytes: number;
  uploadedAt: Date;
}

export async function uploadResume(
  userId: string,
  file: { name: string; type: string; buffer: Buffer },
): Promise<UploadResumeResult> {
  if (file.buffer.byteLength > MAX_RESUME_SIZE_BYTES) {
    throw Errors.payloadTooLarge("O currículo deve ter no máximo 5 MB.");
  }

  const realMimeType = detectRealMimeType(file.buffer);
  if (!realMimeType || !ALLOWED_RESUME_MIME_TYPES.includes(realMimeType as (typeof ALLOWED_RESUME_MIME_TYPES)[number])) {
    throw Errors.unsupportedMediaType("Envie um arquivo PDF ou DOCX válido.");
  }

  const candidate = await prisma.candidate.findUnique({ where: { userId }, select: { id: true } });
  if (!candidate) throw Errors.notFound("Perfil");

  // Conteúdo cifrado antes do upload (R4) — o bucket nunca guarda o arquivo em claro.
  const encryptedContent = Buffer.from(encrypt(file.buffer.toString("base64")), "utf8");
  const { storageKey } = await uploadPrivateObject(candidate.id, encryptedContent, "application/octet-stream");

  // RN001/FR-032: extrai o texto antes de qualquer exibição a recrutador. Nunca bloqueia o
  // upload — PDF ilegível (ex.: escaneado como imagem) só reduz o sinal do score (R13).
  const extractedText = await extractText(file.buffer, realMimeType);
  const parseStatus = extractedText ? "PARSED" : "FAILED";

  const resume = await prisma.$transaction(async (tx) => {
    // FR-015: preserva a versão anterior, só move a flag isCurrent.
    await tx.resume.updateMany({ where: { candidateId: candidate.id, isCurrent: true }, data: { isCurrent: false } });

    return tx.resume.create({
      data: {
        candidateId: candidate.id,
        storageKey,
        originalFilename: file.name,
        mimeType: realMimeType,
        sizeBytes: file.buffer.byteLength,
        isCurrent: true,
        extractedText: encryptOrNull(extractedText),
        parseStatus,
      },
    });
  });

  // Gatilho 1 (FR-034): recalcula o match com todas as vagas publicadas. Fire-and-forget —
  // não bloqueia a resposta do upload; falha aqui não derruba a candidatura nem o upload.
  recomputeJobMatchesForCandidate(candidate.id).catch(() => {});

  return {
    id: resume.id,
    originalFilename: resume.originalFilename,
    sizeBytes: resume.sizeBytes,
    uploadedAt: resume.uploadedAt,
  };
}
