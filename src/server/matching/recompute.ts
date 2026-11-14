// Recálculo de JobMatch (FR-034) — roda nos gatilhos (upload de currículo, sync de GitHub,
// publicação de vaga). A leitura (GET /api/jobs, detalhe) só chama `computeMissingMatches`,
// que cria o que ainda não existe e nunca altera uma linha já emitida (RN003).

import { prisma } from "@/lib/prisma";
import { logSafeError } from "@/lib/errors";
import { decryptOrNull } from "@/server/crypto";
import { computeScore, type GithubLanguageSignal } from "@/server/matching/score";

function parseGithubLanguages(languages: unknown): GithubLanguageSignal[] | null {
  if (!Array.isArray(languages) || languages.length === 0) return null;
  return languages
    .filter((entry): entry is { name: unknown; share: unknown } => typeof entry === "object" && entry !== null)
    .map((entry) => ({ name: String(entry.name), share: Number(entry.share) || 0 }))
    .filter((entry) => entry.name.length > 0);
}

export async function getCandidateSignals(candidateId: string) {
  const [currentResume, githubProfile, candidate] = await Promise.all([
    prisma.resume.findFirst({ where: { candidateId, isCurrent: true }, select: { extractedText: true } }),
    prisma.githubProfile.findUnique({ where: { candidateId }, select: { languages: true } }),
    prisma.candidate.findUnique({ where: { id: candidateId }, select: { technologies: true } }),
  ]);

  // Spec 007 (FR-708): as tecnologias declaradas no perfil entram no sinal de currículo —
  // uma tecnologia conta se estiver no texto do arquivo OU na lista do perfil. Uma por
  // linha, para o casamento por palavra inteira do score.ts não juntar termos vizinhos.
  const resumeText = [decryptOrNull(currentResume?.extractedText ?? null), ...(candidate?.technologies ?? [])]
    .filter(Boolean)
    .join("\n");

  return {
    resumeText: resumeText || null,
    githubLanguages: githubProfile ? parseGithubLanguages(githubProfile.languages) : null,
  };
}

/** Gatilhos 1-2 (R13/R14): currículo trocado ou GitHub sincronizado — recalcula para TODAS as vagas publicadas. */
export async function recomputeJobMatchesForCandidate(candidateId: string): Promise<void> {
  const signals = await getCandidateSignals(candidateId);

  const jobs = await prisma.job.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, technologies: true },
  });

  await upsertMatches(candidateId, jobs, signals);
}

/** Gatilho 3: publicação de uma vaga — cria JobMatch inicial para todo candidato com currículo vigente ou tecnologias no perfil. */
export async function recomputeJobMatchesForJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, technologies: true } });
  if (!job) return;

  const candidates = await prisma.candidate.findMany({
    where: { OR: [{ resumes: { some: { isCurrent: true } } }, { technologies: { isEmpty: false } }] },
    select: { id: true },
  });

  await Promise.all(
    candidates.map(async (candidate) => {
      const signals = await getCandidateSignals(candidate.id);
      await upsertMatches(candidate.id, [job], signals);
    }),
  );
}

async function upsertMatches(
  candidateId: string,
  jobs: { id: string; technologies: string[] }[],
  signals: Awaited<ReturnType<typeof getCandidateSignals>>,
): Promise<void> {
  for (const job of jobs) {
    const result = computeScore(job.technologies, signals);
    if (!result) continue; // sem nenhum sinal — nenhuma linha é criada (FR-036)

    await prisma.jobMatch.upsert({
      where: { candidateId_jobId: { candidateId, jobId: job.id } },
      create: {
        candidateId,
        jobId: job.id,
        score: result.score,
        justification: { matched: result.matched, missing: result.missing },
      },
      update: {
        score: result.score,
        justification: { matched: result.matched, missing: result.missing },
        computedAt: new Date(),
        staleSince: null,
      },
    });
  }
}

/**
 * Calcula só o que falta (candidato × vaga sem JobMatch), sem tocar no que já foi emitido (RN003).
 * Devolve o score/justificativa dos que criou; vaga sem nenhum sinal fica de fora (FR-036).
 * Rodar dois pedidos ao mesmo tempo é seguro: `skipDuplicates` mantém a primeira linha gravada.
 */
export async function computeMissingMatches(
  candidateId: string,
  jobs: { id: string; technologies: string[] }[],
): Promise<Map<string, { score: number; matched: string[]; missing: string[] }>> {
  const created = new Map<string, { score: number; matched: string[]; missing: string[] }>();
  if (jobs.length === 0) return created;
  const signals = await getCandidateSignals(candidateId);
  const rows = [];
  for (const job of jobs) {
    const result = computeScore(job.technologies, signals);
    if (!result) continue;
    created.set(job.id, result);
    rows.push({
      candidateId,
      jobId: job.id,
      score: result.score,
      justification: { matched: result.matched, missing: result.missing },
    });
  }
  if (rows.length === 0) return created;
  // A leitura não pode cair por causa do cache: se gravar ou reler falhar, devolve o calculado.
  try {
    await prisma.jobMatch.createMany({ data: rows, skipDuplicates: true });
    // Mostra sempre o que está gravado (RN003), mesmo que outra requisição tenha gravado antes.
    const stored = await prisma.jobMatch.findMany({
      where: { candidateId, jobId: { in: rows.map((row) => row.jobId) } },
      select: { jobId: true, score: true, justification: true },
    });
    for (const row of stored) {
      const justification = row.justification as { matched?: string[]; missing?: string[] } | null;
      created.set(row.jobId, { score: row.score, matched: justification?.matched ?? [], missing: justification?.missing ?? [] });
    }
  } catch (err) {
    logSafeError("matching:computeMissingMatches", err);
  }
  return created;
}
