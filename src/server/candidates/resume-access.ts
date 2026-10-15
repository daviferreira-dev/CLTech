// FR-017 / Princípio I: só o dono do currículo ou Recrutador/Administrador pode
// baixá-lo. Verificação no servidor, nunca apenas na interface — teste obrigatório
// em tests/integration/resume-access.test.ts.

import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { getSignedDownloadUrl } from "@/server/storage";

export interface Requester {
  id: string; // User.id
  role: "CANDIDATE" | "RECRUITER" | "ADMIN";
}

export async function getResumeDownloadUrl(requester: Requester, resumeId: string): Promise<string> {
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

  return getSignedDownloadUrl(resume.storageKey);
}
