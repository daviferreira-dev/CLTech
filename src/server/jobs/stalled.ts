// Spec 010 FR-1002 — candidatos parados: em andamento, em vaga publicada, na mesma etapa há
// mais de STALLED_CANDIDATE_DAYS dias. Separa a espera do RH da espera do candidato (D4).
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_LIMIT_MINUTES, type CodeTestStageConfig } from "@/lib/codeTest";
import { stalledDaysFrom, waitingOnFor, type WaitingOn } from "@/lib/velocity";

const DAY_MS = 86_400_000;

export interface StalledCandidate {
  applicationId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  stageType: string;
  /** Dias inteiros na etapa atual. */
  days: number;
  waitingOn: WaitingOn;
}

export async function listStalledCandidates(filters: { jobId?: string; now?: Date } = {}): Promise<StalledCandidate[]> {
  const now = filters.now ?? new Date();
  const cutoff = new Date(now.getTime() - stalledDaysFrom(process.env) * DAY_MS);

  // A entrada aberta (sem exitedAt) é a etapa atual e diz desde quando a candidatura está nela.
  const rows = await prisma.applicationStageHistory.findMany({
    where: {
      exitedAt: null,
      enteredAt: { lt: cutoff },
      application: {
        status: "IN_PROGRESS",
        job: { status: "PUBLISHED", ...(filters.jobId ? { id: filters.jobId } : {}) },
      },
    },
    orderBy: { enteredAt: "asc" },
    select: {
      applicationId: true,
      stageId: true,
      enteredAt: true,
      stage: { select: { type: true, config: true } },
      application: {
        select: {
          jobId: true,
          job: { select: { title: true } },
          candidate: { select: { user: { select: { name: true } } } },
          codeSubmissions: { select: { id: true }, take: 1 },
          codeDrafts: { select: { stageId: true, startedAt: true } },
        },
      },
    },
  });

  return rows.map((row) => {
    const app = row.application;
    const draft = app.codeDrafts.find((d) => d.stageId === row.stageId) ?? null;
    const config = (row.stage.config ?? {}) as CodeTestStageConfig;
    return {
      applicationId: row.applicationId,
      candidateName: app.candidate.user.name,
      jobId: app.jobId,
      jobTitle: app.job.title,
      stageType: row.stage.type,
      days: Math.floor((now.getTime() - row.enteredAt.getTime()) / DAY_MS),
      waitingOn: waitingOnFor({
        stageType: row.stage.type,
        submitted: app.codeSubmissions.length > 0,
        draftStartedAt: draft?.startedAt ?? null,
        timeLimitMinutes: config.timeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES,
        now,
      }),
    };
  });
}
