// DATABASE_URL de teste (.env.test) — TRUNCATE total antes de cada teste garante isolamento
// mesmo sem banco efêmero dedicado (research.md R8).

import { beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

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
  "User",
];

/** Limpa todas as tabelas de domínio entre testes — isolamento total por teste. */
export async function resetDatabase(): Promise<void> {
  await prisma.$transaction(
    DOMAIN_TABLES.map((table) => prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`)),
  );
}

beforeEach(async () => {
  await resetDatabase();
});
