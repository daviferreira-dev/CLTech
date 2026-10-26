// Direitos do titular — LGPD art. 18, II (acesso) e VI (eliminação). Spec 006, US4 e US5.

import { prisma } from "@/lib/prisma";
import { Errors, logSafeError } from "@/lib/errors";
import { decrypt, decryptOrNull } from "@/server/crypto";
import { deletePrivateObjects } from "@/server/storage";
import { profileDetailsInclude, toProfileDetails } from "@/server/candidates/profile-details";

export const DELETE_CONFIRMATION = "EXCLUIR";

/**
 * Tudo o que a plataforma guarda sobre o candidato, decifrado. Ficam de fora o hash da
 * senha, ids de outros usuários, casos de teste dos desafios (FR-201) e as notas
 * automáticas: o RN004 restringe relatórios a recrutador/administrador — decisão
 * registrada na spec 006, US4.
 */
export async function exportMyData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,
      accounts: { select: { provider: true } },
      candidate: {
        include: {
          externalAccounts: true,
          githubProfile: true,
          resumes: { orderBy: { uploadedAt: "asc" } },
          ...profileDetailsInclude,
          applications: {
            orderBy: { appliedAt: "asc" },
            include: {
              job: { select: { title: true, company: true } },
              currentStage: { select: { type: true } },
              stageHistory: { orderBy: { enteredAt: "asc" }, include: { stage: { select: { type: true } } } },
              codeDrafts: { include: { challenge: { select: { title: true } } } },
              codeSubmissions: { include: { challenge: { select: { title: true } } } },
            },
          },
        },
      },
    },
  });
  const candidate = user.candidate;

  return {
    exportedAt: new Date().toISOString(),
    account: {
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      loginProviders: user.accounts.map((a) => a.provider),
    },
    profile: candidate
      ? {
          phone: decryptOrNull(candidate.phone),
          city: candidate.city,
          state: candidate.state,
          updatedAt: candidate.updatedAt,
          // Spec 007 (FR-709): perfil profissional.
          ...toProfileDetails(candidate),
        }
      : null,
    externalAccounts: (candidate?.externalAccounts ?? []).map((a) => ({
      provider: a.provider,
      username: a.externalUsername,
      url: a.url,
      verifiedAt: a.verifiedAt,
      verifiedName: a.verifiedName,
      status: a.status,
      lastSyncedAt: a.lastSyncedAt,
    })),
    githubProfile: candidate?.githubProfile
      ? {
          publicRepoCount: candidate.githubProfile.publicRepoCount,
          languages: candidate.githubProfile.languages,
          activityLast90Days: candidate.githubProfile.activityLast90Days,
          followers: candidate.githubProfile.followers,
          collectedAt: candidate.githubProfile.collectedAt,
        }
      : null,
    // O arquivo em si é baixado pela rota de download já existente; aqui vão os metadados.
    resumes: (candidate?.resumes ?? []).map((r) => ({
      id: r.id,
      originalFilename: r.originalFilename,
      sizeBytes: r.sizeBytes,
      uploadedAt: r.uploadedAt,
      isCurrent: r.isCurrent,
      downloadPath: `/api/resumes/${r.id}/download`,
    })),
    applications: (candidate?.applications ?? []).map((a) => ({
      job: a.job,
      appliedAt: a.appliedAt,
      status: a.status,
      currentStage: a.currentStage.type,
      stageHistory: a.stageHistory.map((h) => ({ stage: h.stage.type, enteredAt: h.enteredAt, exitedAt: h.exitedAt })),
      codeDrafts: a.codeDrafts.map((d) => ({
        challenge: d.challenge.title,
        language: d.language,
        sourceCode: decrypt(d.sourceCode),
        startedAt: d.startedAt,
        updatedAt: d.updatedAt,
      })),
      codeSubmissions: a.codeSubmissions.map((s) => ({
        challenge: s.challenge.title,
        language: s.language,
        sourceCode: decrypt(s.sourceCode),
        submittedAt: s.submittedAt,
        submittedBy: s.submittedBy,
      })),
    })),
  };
}

/**
 * Exclusão definitiva (não anonimização) — spec 006, US5. O banco sai numa transação; o
 * bucket em melhor esforço depois dela: um objeto órfão já está cifrado e sem nome de
 * pessoa na chave (L3), e prender o titular a uma conta que pediu para eliminar por causa
 * dele seria pior.
 */
export async function deleteMyAccount(userId: string, confirmation: unknown): Promise<void> {
  if (confirmation !== DELETE_CONFIRMATION) {
    throw Errors.businessRule("CONFIRMATION_REQUIRED", `Digite ${DELETE_CONFIRMATION} para confirmar a exclusão.`);
  }

  const resumes = await prisma.resume.findMany({
    where: { candidate: { userId } },
    select: { storageKey: true },
  });

  await prisma.$transaction(async (tx) => {
    // Application → Resume é RESTRICT: as candidaturas saem antes para o cascade de
    // Candidate não esbarrar na ordem em que o Postgres apaga Resume e Application.
    await tx.application.deleteMany({ where: { candidate: { userId } } });
    await tx.user.delete({ where: { id: userId } });
  });

  try {
    await deletePrivateObjects(resumes.map((r) => r.storageKey));
  } catch (err) {
    logSafeError("account-delete storage", err);
  }
}
