// FR-017 / Princípio I: só o dono do currículo ou Recrutador/Administrador pode
// baixá-lo. Verificação no servidor, nunca apenas na interface — teste obrigatório
// em tests/integration/resume-access.test.ts.

import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { decrypt } from "@/server/crypto";
import { getPrivateObject } from "@/server/storage";

export interface Requester {
  id: string; // User.id
  role: "CANDIDATE" | "RECRUITER" | "ADMIN";
}

export interface ResumeFile {
  filename: string;
  mimeType: string;
  content: Buffer;
}

export async function getResumeFile(requester: Requester, resumeId: string): Promise<ResumeFile> {
  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    include: { candidate: { select: { userId: true } } },
  });
  if (!resume) throw Errors.notFound("Currículo");

  const isOwner = resume.candidate.userId === requester.id;
  const isStaff = requester.role === "RECRUITER" || requester.role === "ADMIN";

  if (!isOwner && !isStaff) {
    throw Errors.forbidden();
  }

  // O bucket guarda o arquivo cifrado (R4, ver uploadResume): base64 do original, cifrado em
  // AES-256-GCM. Decifra aqui, depois da checagem de papel, e entrega o arquivo original.
  // Linha sem arquivo (seed antigo, objeto apagado à mão): 404 amigável, não 500.
  const stored = await getPrivateObject(resume.storageKey).catch((err: { code?: string; name?: string }) => {
    if (err?.code === "ENOENT" || err?.name === "NoSuchKey") throw Errors.notFound("Arquivo do currículo");
    throw err;
  });
  const content = Buffer.from(decrypt(stored.toString("utf8")), "base64");
  return { filename: resume.originalFilename, mimeType: resume.mimeType, content };
}
