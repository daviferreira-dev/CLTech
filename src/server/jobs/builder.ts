// RF04 / FR-038..042 / RN002 — criação, edição e publicação de vaga pelo recrutador.
// Vaga publicada trava tecnologias/requisitos/etapas (FR-041, D7 da Sprint 1).
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors, ApiError } from "@/lib/errors";
import { recomputeJobMatchesForJob } from "@/server/matching/recompute";
import type { CreateJobInput, UpdateJobInput, SetStagesInput, StageEmailInput } from "@/lib/validation/jobs";
import { codeTestConfigSchema } from "@/lib/validation/challenges";
import { MAX_POSITIONS, MIN_POSITIONS } from "@/lib/processStages";
import { isCodeTestConfigComplete, MAX_TEST_RUNS, type CodeTestStageConfig } from "@/lib/codeTest";
import { keepAlive } from "@/server/background";
import { notifyApplicationClosed } from "@/server/email/notify";
import { closeStragglers } from "@/server/jobs/closeStragglers";

const LOCKED_FIELDS = ["technologies", "minimumRequirements"] as const;

// Campos de e-mail (modo/modelo/texto) comuns a uma ProcessStage e, com outro prefixo, ao
// "reprovado"/"aprovado" da vaga — ver normalizeEmailOverride.
interface EmailOverrideInput {
  emailMode?: "DEFAULT" | "TEMPLATE" | "CUSTOM" | "OFF";
  emailTemplateId?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
}
interface NormalizedEmailOverride {
  emailMode: "DEFAULT" | "TEMPLATE" | "CUSTOM" | "OFF";
  emailTemplateId: string | null;
  emailSubject: string | null;
  emailBody: string | null;
}

/**
 * Spec 008: valida e normaliza modo/modelo/texto de um momento (etapa, ou reprovado/aprovado
 * da vaga). Sem `emailMode` explícito, infere CUSTOM quando assunto ou corpo vêm preenchidos
 * (compatível com a tela antiga, que só mandava o texto) — senão é DEFAULT. TEMPLATE exige um
 * modelo que exista na biblioteca; CUSTOM exige assunto e corpo preenchidos.
 */
async function normalizeEmailOverride(input: EmailOverrideInput): Promise<NormalizedEmailOverride> {
  const hasText = Boolean(input.emailSubject?.trim() || input.emailBody?.trim());
  const mode = input.emailMode ?? (hasText ? "CUSTOM" : "DEFAULT");

  if (mode === "TEMPLATE") {
    if (!input.emailTemplateId) throw Errors.validation("Escolha um modelo da biblioteca.");
    const template = await prisma.emailTemplate.findUnique({ where: { id: input.emailTemplateId }, select: { id: true } });
    if (!template) throw Errors.validation("O modelo escolhido não existe mais na biblioteca.");
    return { emailMode: "TEMPLATE", emailTemplateId: input.emailTemplateId, emailSubject: null, emailBody: null };
  }
  if (mode === "CUSTOM") {
    if (!input.emailSubject?.trim() || !input.emailBody?.trim()) {
      throw Errors.validation("Informe o assunto e o texto do e-mail.");
    }
    return { emailMode: "CUSTOM", emailTemplateId: null, emailSubject: input.emailSubject, emailBody: input.emailBody };
  }
  return { emailMode: mode, emailTemplateId: null, emailSubject: null, emailBody: null };
}

export interface RecruiterJobView {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  seniority: "INTERN" | "JUNIOR" | "MID" | "SENIOR";
  technologies: string[];
  minimumRequirements: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  publishedAt: Date | null;
  rejectedEmailMode: string;
  rejectedEmailTemplateId: string | null;
  rejectedEmailSubject: string | null;
  rejectedEmailBody: string | null;
  approvedEmailMode: string;
  approvedEmailTemplateId: string | null;
  approvedEmailSubject: string | null;
  approvedEmailBody: string | null;
  stages: Array<{
    id: string;
    type: string;
    order: number;
    config: unknown;
    emailMode: string;
    emailTemplateId: string | null;
    emailSubject: string | null;
    emailBody: string | null;
  }>;
}

async function toView(jobId: string): Promise<RecruiterJobView> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      stages: {
        orderBy: { order: "asc" },
        select: { id: true, type: true, order: true, config: true, emailMode: true, emailTemplateId: true, emailSubject: true, emailBody: true },
      },
    },
  });
  return job;
}

/**
 * Spec 005 US1: valida e normaliza a configuração de cada etapa CODE_TEST — desafio que
 * existe, linguagens sempre subconjunto das do desafio, tempo dentro dos limites e o teto
 * de execuções do D5 fixado pelo servidor. Incompleta é aceita no rascunho; a publicação
 * é que exige completa.
 */
async function normalizeCodeTestConfig(config: Record<string, unknown> | undefined): Promise<CodeTestStageConfig> {
  const parsed = codeTestConfigSchema.safeParse(config ?? {});
  if (!parsed.success) throw Errors.validation(parsed.error.issues[0]?.message ?? "Configuração do teste de código inválida.");
  const { challengeId, languages, timeLimitMinutes } = parsed.data;
  if (!challengeId) return { ...parsed.data, maxTestRuns: MAX_TEST_RUNS };

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId }, select: { languages: true } });
  if (!challenge) throw Errors.validation("O desafio escolhido não existe mais no catálogo.");
  const chosen = languages && languages.length > 0 ? languages : challenge.languages;
  const outside = chosen.filter((language) => !challenge.languages.includes(language));
  if (outside.length > 0) {
    throw Errors.validation(`Linguagem fora das aceitas pelo desafio: ${outside.join(", ")}.`);
  }
  return { challengeId, languages: chosen, timeLimitMinutes, maxTestRuns: MAX_TEST_RUNS };
}

/** Proposta Final: grava só `positions`, inteiro dentro dos limites (padrão 1). */
function normalizeFinalOfferConfig(config: Record<string, unknown> | undefined): { positions: number } {
  const raw = config?.positions ?? MIN_POSITIONS;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < MIN_POSITIONS || raw > MAX_POSITIONS) {
    throw Errors.validation(`A quantidade de vagas da proposta final deve ser um inteiro entre ${MIN_POSITIONS} e ${MAX_POSITIONS}.`);
  }
  return { positions: raw };
}

export async function createJob(userId: string, input: CreateJobInput): Promise<RecruiterJobView> {
  const job = await prisma.job.create({
    data: { ...input, status: "DRAFT", createdById: userId },
  });
  return toView(job.id);
}

export async function updateDraftJob(jobId: string, input: UpdateJobInput): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw Errors.notFound("Vaga", true);

  if (job.status !== "DRAFT") {
    const touchesLockedField = LOCKED_FIELDS.some((field) => input[field] !== undefined);
    if (touchesLockedField) {
      throw Errors.conflict("JOB_LOCKED", "Vagas publicadas ou encerradas têm tecnologias e requisitos travados.");
    }
  }

  // Spec 008: e-mail de "reprovado"/"aprovado" é só texto — vale mesmo com a vaga publicada,
  // igual ao e-mail de etapa (não entra em LOCKED_FIELDS).
  const { rejected, approved, ...fields } = await normalizeJobEmailFields(input);

  await prisma.job.update({ where: { id: jobId }, data: { ...fields, ...rejected, ...approved } });
  return toView(jobId);
}

type RejectedCols = { rejectedEmailMode: NormalizedEmailOverride["emailMode"]; rejectedEmailTemplateId: string | null; rejectedEmailSubject: string | null; rejectedEmailBody: string | null };
type ApprovedCols = { approvedEmailMode: NormalizedEmailOverride["emailMode"]; approvedEmailTemplateId: string | null; approvedEmailSubject: string | null; approvedEmailBody: string | null };

/** Separa os campos de e-mail do resto do PATCH e normaliza cada momento, só quando enviado. */
async function normalizeJobEmailFields(
  input: UpdateJobInput,
): Promise<Omit<UpdateJobInput, keyof RejectedCols | keyof ApprovedCols> & { rejected: Partial<RejectedCols>; approved: Partial<ApprovedCols> }> {
  const { rejectedEmailMode, rejectedEmailTemplateId, rejectedEmailSubject, rejectedEmailBody, approvedEmailMode, approvedEmailTemplateId, approvedEmailSubject, approvedEmailBody, ...fields } = input;

  const touchesRejected = [rejectedEmailMode, rejectedEmailTemplateId, rejectedEmailSubject, rejectedEmailBody].some((v) => v !== undefined);
  const touchesApproved = [approvedEmailMode, approvedEmailTemplateId, approvedEmailSubject, approvedEmailBody].some((v) => v !== undefined);

  const rejected: Partial<RejectedCols> = {};
  if (touchesRejected) {
    const n = await normalizeEmailOverride({ emailMode: rejectedEmailMode, emailTemplateId: rejectedEmailTemplateId, emailSubject: rejectedEmailSubject, emailBody: rejectedEmailBody });
    Object.assign(rejected, { rejectedEmailMode: n.emailMode, rejectedEmailTemplateId: n.emailTemplateId, rejectedEmailSubject: n.emailSubject, rejectedEmailBody: n.emailBody });
  }
  const approved: Partial<ApprovedCols> = {};
  if (touchesApproved) {
    const n = await normalizeEmailOverride({ emailMode: approvedEmailMode, emailTemplateId: approvedEmailTemplateId, emailSubject: approvedEmailSubject, emailBody: approvedEmailBody });
    Object.assign(approved, { approvedEmailMode: n.emailMode, approvedEmailTemplateId: n.emailTemplateId, approvedEmailSubject: n.emailSubject, approvedEmailBody: n.emailBody });
  }

  return { ...fields, rejected, approved };
}

/** Substitui o conjunto inteiro de etapas, já ordenado (FR-039/042, R16). */
export async function setStages(jobId: string, input: SetStagesInput): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw Errors.notFound("Vaga", true);
  if (job.status !== "DRAFT") {
    throw Errors.conflict("JOB_LOCKED", "Vagas publicadas ou encerradas têm o pipeline travado.");
  }

  if (input.stages.filter((stage) => stage.type === "FINAL_OFFER").length > 1) {
    throw Errors.validation("A vaga pode ter só uma Proposta Final; use a quantidade de vagas para contratar mais de uma pessoa.");
  }

  // Substituição completa (FR-039/042): sob Read Committed, dois PUT concorrentes
  // entrelaçam o delete de um com o insert do outro e colidem no índice único
  // (jobId, order). Serializable faz o banco recusar o entrelaçamento em vez de
  // gravar um pipeline pela metade.
  const [configs, emails] = await Promise.all([
    Promise.all(
      input.stages.map((stage) => {
        if (stage.type === "CODE_TEST") return normalizeCodeTestConfig(stage.config);
        if (stage.type === "FINAL_OFFER") return normalizeFinalOfferConfig(stage.config);
        return stage.config ?? {};
      }),
    ),
    Promise.all(input.stages.map((stage) => normalizeEmailOverride(stage))),
  ]);

  await prisma.$transaction(
    async (tx) => {
      await tx.processStage.deleteMany({ where: { jobId } });
      await tx.processStage.createMany({
        data: input.stages.map((stage, index) => ({
          jobId,
          type: stage.type,
          order: index,
          config: configs[index] as Prisma.InputJsonValue,
          ...emails[index],
        })),
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return toView(jobId);
}

/**
 * E-mail de uma etapa: padrão, modelo da biblioteca ou texto próprio — para todo tipo de
 * etapa (spec 008; antes só entrevista). Não trava com a vaga publicada: é só texto, vale
 * para os próximos avanços sem mudar o processo que o candidato percorre.
 */
export async function setStageEmail(jobId: string, input: StageEmailInput): Promise<RecruiterJobView> {
  const stage = await prisma.processStage.findFirst({ where: { id: input.stageId, jobId }, select: { id: true } });
  if (!stage) throw Errors.notFound("Etapa", true);
  const normalized = await normalizeEmailOverride(input);
  await prisma.processStage.update({ where: { id: input.stageId }, data: normalized });
  return toView(jobId);
}

/** Transição DRAFT -> PUBLISHED (FR-040, RN002). */
export async function publishJob(jobId: string): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      status: true,
      technologies: true,
      minimumRequirements: true,
      _count: { select: { stages: true } },
      stages: { where: { type: "CODE_TEST" }, select: { config: true } },
    },
  });
  if (!job) throw Errors.notFound("Vaga", true);
  if (job.status === "CLOSED") throw Errors.conflict("JOB_CLOSED", "Vaga encerrada.");
  if (job.status !== "DRAFT") {
    throw Errors.conflict("ALREADY_PUBLISHED", "Esta vaga já foi publicada.");
  }

  const missing: string[] = [];
  if (job.technologies.length === 0) missing.push("technologies");
  if (!job.minimumRequirements.trim()) missing.push("minimumRequirements");
  if (job._count.stages === 0) missing.push("stages");
  // Spec 005 US1.2: etapa de teste de código sem desafio travaria o candidato nela.
  if (job.stages.some((stage) => !isCodeTestConfigComplete(stage.config))) missing.push("codeTest");

  if (missing.length > 0) {
    throw new ApiError(
      422,
      "INCOMPLETE_JOB",
      "Preencha tecnologias, requisitos mínimos, ao menos uma etapa e a configuração do teste de código antes de publicar.",
      { missing },
    );
  }

  await prisma.job.update({ where: { id: jobId }, data: { status: "PUBLISHED", publishedAt: new Date() } });

  // Gatilho 3 (FR-034): cria o JobMatch inicial para candidatos elegíveis. Fire-and-forget.
  keepAlive(recomputeJobMatchesForJob(jobId).catch(() => {}));

  return toView(jobId);
}

/**
 * Encerramento manual PUBLISHED -> CLOSED; o automático fica em decision.ts (Proposta Final).
 * Quem ainda estava em andamento é reprovado e avisado (JOB_CLOSED), um e-mail por candidato.
 */
export async function closeJob(jobId: string, decidedByUserId: string): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true, title: true, company: true } });
  if (!job) throw Errors.notFound("Vaga", true);
  if (job.status === "CLOSED") throw Errors.conflict("JOB_CLOSED", "Vaga encerrada.");
  if (job.status !== "PUBLISHED") throw Errors.conflict("NOT_PUBLISHED", "Só vagas publicadas podem ser encerradas.");

  const now = new Date();
  const affected = await prisma.$transaction(async (tx) => {
    await tx.job.update({ where: { id: jobId }, data: { status: "CLOSED" } });
    return closeStragglers(tx, jobId, now, { decidedByUserId });
  });

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  for (const straggler of affected) {
    keepAlive(
      notifyApplicationClosed({
        to: straggler.candidate.user,
        jobTitle: job.title,
        company: job.company,
        stageType: straggler.currentStage.type,
        moment: "JOB_CLOSED",
        appUrl,
      }),
    );
  }

  return toView(jobId);
}

export interface RecruiterJobListItem {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  candidateCount: number;
  createdAt: Date;
}

export async function listRecruiterJobs(): Promise<RecruiterJobListItem[]> {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, createdAt: true, _count: { select: { applications: true } } },
  });
  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    status: job.status,
    candidateCount: job._count.applications,
    createdAt: job.createdAt,
  }));
}

export async function getRecruiterJobView(jobId: string): Promise<RecruiterJobView> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw Errors.notFound("Vaga", true);
  return toView(jobId);
}
