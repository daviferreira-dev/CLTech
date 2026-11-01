// DATABASE_URL de teste (carregado por env.ts) — TRUNCATE total antes de cada teste garante
// isolamento mesmo sem banco efêmero dedicado (research.md R8).

import { beforeEach } from "vitest";
import type { EmailMoment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/emailMoments";

const DOMAIN_TABLES = [
  "CodeSubmission",
  "CodeDraft",
  "Evaluation",
  "Challenge",
  "ApplicationStageHistory",
  "Application",
  "JobMatch",
  "ProcessStage",
  "Job",
  "Resume",
  "GithubProfile",
  "ExternalAccount",
  "Candidate",
  "Session",
  "Account",
  "VerificationToken",
  "RateLimit",
  "User",
  "EmailTemplate",
];

/** Limpa todas as tabelas de domínio entre testes — isolamento total por teste. */
export async function resetDatabase(): Promise<void> {
  await prisma.$transaction(
    DOMAIN_TABLES.map((table) => prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`)),
  );
  // EmailTemplate.defaultFor nunca pode faltar (resolve.ts sempre espera um) — a migration
  // semeia em produção, aqui reinserimos a cada teste, como a migration faria.
  await prisma.emailTemplate.createMany({
    data: Object.entries(DEFAULT_EMAIL_TEMPLATES).map(([moment, t]) => ({ ...t, defaultFor: moment as EmailMoment })),
  });
}

beforeEach(async () => {
  await resetDatabase();
});
