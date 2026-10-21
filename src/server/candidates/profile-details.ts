// Perfil profissional (spec 007) — leitura e gravação das colunas/tabelas novas, usado
// pelo perfil do candidato, pelo relatório da candidatura e pela exportação LGPD.

import type { Prisma } from "@prisma/client";
import type { ProfileDetails } from "@/lib/profile-details";
import type { UpdateProfileInput } from "@/lib/validation/profile";

export const profileDetailsInclude = {
  experiences: { orderBy: { position: "asc" } },
  educations: { orderBy: { position: "asc" } },
  languages: { orderBy: { position: "asc" } },
  profileLinks: { orderBy: { position: "asc" } },
} satisfies Prisma.CandidateInclude;

type CandidateWithDetails = Prisma.CandidateGetPayload<{ include: typeof profileDetailsInclude }>;

/** Date (dia 1, UTC) → "YYYY-MM" (FR-703). */
function toMonth(date: Date): string;
function toMonth(date: Date | null): string | null;
function toMonth(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 7) : null;
}

/** "YYYY-MM" → Date no dia 1, 00:00 UTC. */
function fromMonth(month: string): Date;
function fromMonth(month: string | null): Date | null;
function fromMonth(month: string | null): Date | null {
  return month ? new Date(`${month}-01T00:00:00.000Z`) : null;
}

export function toProfileDetails(candidate: CandidateWithDetails): ProfileDetails {
  return {
    headline: candidate.headline,
    summary: candidate.summary,
    technologies: candidate.technologies,
    softSkills: candidate.softSkills,
    experiences: candidate.experiences.map((e) => ({
      company: e.company,
      role: e.role,
      startDate: toMonth(e.startDate),
      endDate: toMonth(e.endDate),
      isCurrent: e.isCurrent,
      description: e.description,
    })),
    educations: candidate.educations.map((e) => ({
      institution: e.institution,
      course: e.course,
      level: e.level,
      startDate: toMonth(e.startDate),
      endDate: toMonth(e.endDate),
      inProgress: e.inProgress,
    })),
    languages: candidate.languages.map((l) => ({ name: l.name, level: l.level })),
    links: candidate.profileLinks.map((l) => ({ label: l.label, url: l.url })),
  };
}

/** Colunas do perfil profissional em Candidate — só as que vieram no PATCH. */
export function profileDetailsColumns(input: UpdateProfileInput): Prisma.CandidateUpdateInput {
  return {
    ...(input.headline !== undefined ? { headline: input.headline || null } : {}),
    ...(input.summary !== undefined ? { summary: input.summary || null } : {}),
    ...(input.technologies !== undefined ? { technologies: input.technologies } : {}),
    ...(input.softSkills !== undefined ? { softSkills: input.softSkills } : {}),
  };
}

/**
 * Substitui cada lista enviada inteira (FR-704). Roda dentro da transação do
 * updateProfile: falha em qualquer lista desfaz todas.
 */
export async function replaceProfileLists(
  tx: Prisma.TransactionClient,
  candidateId: string,
  input: UpdateProfileInput,
): Promise<void> {
  if (input.experiences) {
    await tx.experience.deleteMany({ where: { candidateId } });
    await tx.experience.createMany({
      data: input.experiences.map((e, position) => ({
        candidateId,
        position,
        company: e.company,
        role: e.role,
        startDate: fromMonth(e.startDate),
        endDate: e.isCurrent ? null : fromMonth(e.endDate),
        isCurrent: e.isCurrent,
        description: e.description || null,
      })),
    });
  }
  if (input.educations) {
    await tx.education.deleteMany({ where: { candidateId } });
    await tx.education.createMany({
      data: input.educations.map((e, position) => ({
        candidateId,
        position,
        institution: e.institution,
        course: e.course,
        level: e.level,
        startDate: fromMonth(e.startDate),
        endDate: fromMonth(e.endDate),
        inProgress: e.inProgress,
      })),
    });
  }
  if (input.languages) {
    await tx.language.deleteMany({ where: { candidateId } });
    await tx.language.createMany({
      data: input.languages.map((l, position) => ({ candidateId, position, name: l.name, level: l.level })),
    });
  }
  if (input.links) {
    await tx.profileLink.deleteMany({ where: { candidateId } });
    await tx.profileLink.createMany({
      data: input.links.map((l, position) => ({ candidateId, position, label: l.label, url: l.url })),
    });
  }
}
