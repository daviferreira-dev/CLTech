// RF02 / FR-009: visualizar e editar dados básicos do candidato.
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { decryptOrNull, encryptOrNull } from "@/server/crypto";
import type { UpdateProfileInput } from "@/lib/validation/profile";
import type { ProfileDetails } from "@/lib/profile-details";
import { profileDetailsColumns, profileDetailsInclude, replaceProfileLists, toProfileDetails } from "@/server/candidates/profile-details";
import { recomputeJobMatchesForCandidate } from "@/server/matching/recompute";
import { keepAlive } from "@/server/background";

export interface ProfileView {
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  /** Perfil profissional (spec 007). */
  details: ProfileDetails;
  externalAccounts: Array<{
    provider: "GITHUB" | "LINKEDIN" | "LATTES";
    status: "PENDING" | "CONNECTED" | "UNAVAILABLE" | "DISCONNECTED";
    externalUsername: string | null;
    unavailableReason: string | null;
    lastSyncedAt: Date | null;
  }>;
  githubProfile: {
    publicRepoCount: number;
    languages: unknown;
    activityLast90Days: number;
    collectedAt: Date;
  } | null;
  resume: {
    id: string;
    originalFilename: string;
    sizeBytes: number;
    uploadedAt: Date;
  } | null;
}

async function findCandidateByUserId(userId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { userId },
    include: {
      user: true,
      externalAccounts: true,
      githubProfile: true,
      resumes: { where: { isCurrent: true }, take: 1 },
      ...profileDetailsInclude,
    },
  });
  if (!candidate) throw Errors.notFound("Perfil");
  return candidate;
}

export async function getProfile(userId: string): Promise<ProfileView> {
  const candidate = await findCandidateByUserId(userId);
  const currentResume = candidate.resumes[0] ?? null;

  return {
    name: candidate.user.name,
    email: candidate.user.email,
    phone: decryptOrNull(candidate.phone),
    city: candidate.city,
    state: candidate.state,
    details: toProfileDetails(candidate),
    externalAccounts: candidate.externalAccounts.map((acc) => ({
      provider: acc.provider,
      status: acc.status,
      externalUsername: acc.externalUsername,
      unavailableReason: acc.unavailableReason,
      lastSyncedAt: acc.lastSyncedAt,
    })),
    githubProfile: candidate.githubProfile
      ? {
          publicRepoCount: candidate.githubProfile.publicRepoCount,
          languages: candidate.githubProfile.languages,
          activityLast90Days: candidate.githubProfile.activityLast90Days,
          collectedAt: candidate.githubProfile.collectedAt,
        }
      : null,
    resume: currentResume
      ? {
          id: currentResume.id,
          originalFilename: currentResume.originalFilename,
          sizeBytes: currentResume.sizeBytes,
          uploadedAt: currentResume.uploadedAt,
        }
      : null,
  };
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<ProfileView> {
  const candidate = await prisma.candidate.findUnique({ where: { userId } });
  if (!candidate) throw Errors.notFound("Perfil");

  // Interativa: as listas do perfil profissional são apagadas e recriadas (FR-704), e
  // nada pode ficar pela metade se uma delas falhar.
  await prisma.$transaction(async (tx) => {
    if (input.name) await tx.user.update({ where: { id: userId }, data: { name: input.name } });
    await tx.candidate.update({
      where: { userId },
      data: {
        ...(input.phone !== undefined ? { phone: encryptOrNull(input.phone || null) } : {}),
        ...(input.city !== undefined ? { city: input.city || null } : {}),
        ...(input.state !== undefined ? { state: input.state || null } : {}),
        ...profileDetailsColumns(input),
      },
    });
    await replaceProfileLists(tx, candidate.id, input);
  });

  // FR-708: tecnologias do perfil contam no match — mesmo gatilho fire-and-forget do upload.
  if (input.technologies !== undefined) keepAlive(recomputeJobMatchesForCandidate(candidate.id).catch(() => {}));

  return getProfile(userId);
}
