// Spec 010 FR-1005 / US3: um e-mail por recrutador com os candidatos parados esperando por ele,
// agrupados por vaga. Quem espera o candidato (teste de código no prazo, D4) fica de fora, e quem
// não tem nada parado não recebe nada. Sem SMTP, sendMail não faz nada e a varredura termina igual.
import { prisma } from "@/lib/prisma";
import { stalledDaysFrom } from "@/lib/velocity";
import { sendMail } from "@/server/email/mailer";
import { recruiterDigestEmail, type RecruiterDigestJob } from "@/server/email/templates/recruiter-digest";
import { listStalledCandidates } from "@/server/jobs/stalled";

export interface RecruiterDigestResult {
  recruiters: number;
  candidates: number;
}

export async function sendRecruiterDigests(options: { now?: Date } = {}): Promise<RecruiterDigestResult> {
  const stalled = (await listStalledCandidates({ now: options.now })).filter((s) => s.waitingOn === "RECRUITER");
  if (stalled.length === 0) return { recruiters: 0, candidates: 0 };

  const jobs = await prisma.job.findMany({
    where: { id: { in: [...new Set(stalled.map((s) => s.jobId))] } },
    select: { id: true, createdBy: { select: { id: true, name: true, email: true } } },
  });
  const ownerByJob = new Map(jobs.map((job) => [job.id, job.createdBy]));

  // Recrutador → vaga → candidatos, mantendo a ordem do mais antigo (listStalledCandidates já ordena).
  const byRecruiter = new Map<string, { name: string; email: string; jobs: Map<string, RecruiterDigestJob> }>();
  for (const item of stalled) {
    const owner = ownerByJob.get(item.jobId);
    if (!owner) continue;
    const entry = byRecruiter.get(owner.id) ?? { name: owner.name, email: owner.email, jobs: new Map() };
    const job = entry.jobs.get(item.jobId) ?? { jobId: item.jobId, jobTitle: item.jobTitle, candidates: [] };
    job.candidates.push({ applicationId: item.applicationId, candidateName: item.candidateName, stageType: item.stageType, days: item.days });
    entry.jobs.set(item.jobId, job);
    byRecruiter.set(owner.id, entry);
  }

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const stalledDays = stalledDaysFrom(process.env);
  let candidates = 0;
  // Um por vez: o SMTP do plano gratuito não gosta de rajada, e são poucos recrutadores.
  for (const recruiter of byRecruiter.values()) {
    const jobsList = [...recruiter.jobs.values()];
    candidates += jobsList.reduce((sum, job) => sum + job.candidates.length, 0);
    await sendMail(recruiterDigestEmail({ to: recruiter.email, recruiterName: recruiter.name, stalledDays, jobs: jobsList, appUrl }));
  }
  return { recruiters: byRecruiter.size, candidates };
}
