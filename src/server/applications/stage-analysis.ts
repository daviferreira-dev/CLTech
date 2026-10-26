// Análise automática das etapas RESUME_ANALYSIS e GITHUB_ANALYSIS: roda quando a candidatura
// entra na etapa, com os dados mais recentes. Avaliação é imutável (Princípio II) — cada
// execução insere uma nova versão; o relatório mostra a mais recente.
import { prisma } from "@/lib/prisma";
import { decryptOrNull } from "@/server/crypto";
import { collectGithubProfile } from "@/server/integrations/github";
import { computeScore } from "@/server/matching/score";

type GithubLanguage = { name: string; share: number };

function readLanguages(raw: unknown): GithubLanguage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is { name: unknown; share: unknown } => typeof entry === "object" && entry !== null)
    .map((entry) => ({ name: String(entry.name), share: Number(entry.share) || 0 }))
    .filter((entry) => entry.name.length > 0);
}

async function nextVersion(applicationId: string, type: "RESUME_MATCH" | "GITHUB_ANALYSIS"): Promise<number> {
  const latest = await prisma.evaluation.findFirst({
    where: { applicationId, type },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

async function analyzeResume(applicationId: string): Promise<void> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      candidate: { select: { technologies: true } },
      job: { select: { technologies: true } },
      resume: { select: { extractedText: true } },
    },
  });
  if (!application) return;

  const extracted = decryptOrNull(application.resume.extractedText ?? null);
  const resumeText = [extracted, ...application.candidate.technologies].filter(Boolean).join("\n");
  const result = computeScore(application.job.technologies, { resumeText: resumeText || null, githubLanguages: null }) ?? {
    score: 0,
    matched: [],
    missing: application.job.technologies,
  };

  await prisma.$transaction([
    prisma.evaluation.create({
      data: {
        applicationId,
        type: "RESUME_MATCH",
        score: result.score,
        version: await nextVersion(applicationId, "RESUME_MATCH"),
        justification: { matched: result.matched, missing: result.missing, resumeReadable: !!extracted },
      },
    }),
    prisma.application.update({
      where: { id: applicationId },
      data: { matchScore: result.score, matchScoreStatus: "CALCULATED" },
    }),
  ]);
}

async function analyzeGithub(applicationId: string): Promise<void> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { candidateId: true, job: { select: { technologies: true } } },
  });
  if (!application) return;
  const { candidateId } = application;

  // Dados frescos: o snapshot pode ter semanas. Falha na coleta não derruba a análise.
  const account = await prisma.externalAccount.findUnique({
    where: { candidateId_provider: { candidateId, provider: "GITHUB" } },
    select: { status: true, externalUsername: true },
  });
  if (account && account.status !== "DISCONNECTED" && account.externalUsername) {
    await collectGithubProfile(candidateId, account.externalUsername);
  }

  const [profile, refreshed] = await Promise.all([
    prisma.githubProfile.findUnique({ where: { candidateId } }),
    prisma.externalAccount.findUnique({
      where: { candidateId_provider: { candidateId, provider: "GITHUB" } },
      select: { status: true, unavailableReason: true, externalUsername: true },
    }),
  ]);

  const languages = profile ? readLanguages(profile.languages) : [];
  const connected = !!refreshed && refreshed.status !== "DISCONNECTED";
  const result =
    languages.length > 0
      ? computeScore(application.job.technologies, { resumeText: null, githubLanguages: languages })
      : null;
  const score = result?.score ?? 0;

  const note = !connected
    ? "Candidato não vinculou o GitHub."
    : refreshed?.status === "UNAVAILABLE"
      ? `GitHub indisponível: ${refreshed.unavailableReason ?? "motivo não informado"}. Exibindo a última coleta.`
      : !profile || languages.length === 0
        ? "Nenhum repositório público com linguagem detectada."
        : null;

  await prisma.evaluation.create({
    data: {
      applicationId,
      type: "GITHUB_ANALYSIS",
      score,
      version: await nextVersion(applicationId, "GITHUB_ANALYSIS"),
      justification: {
        matched: result?.matched ?? [],
        missing: result?.missing ?? application.job.technologies,
        username: refreshed?.externalUsername ?? null,
        publicRepoCount: profile?.publicRepoCount ?? 0,
        followers: profile?.followers ?? 0,
        activityLast90Days: profile?.activityLast90Days ?? 0,
        topLanguages: languages.slice(0, 5),
        collectedAt: profile?.collectedAt.toISOString() ?? null,
        note,
      },
    },
  });
}

/** Executa a análise da etapa em que a candidatura acabou de entrar. Nunca lança. */
export async function runStageAnalysis(applicationId: string, stageType: string): Promise<void> {
  try {
    if (stageType === "RESUME_ANALYSIS") await analyzeResume(applicationId);
    else if (stageType === "GITHUB_ANALYSIS") await analyzeGithub(applicationId);
  } catch (err) {
    console.error(`[stage-analysis] ${stageType} falhou para ${applicationId}`, err);
  }
}
