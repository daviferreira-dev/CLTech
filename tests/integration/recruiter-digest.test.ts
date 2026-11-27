// Spec 010 FR-1005 / US3: resumo diário dos candidatos parados, um e-mail por recrutador,
// agrupado por vaga. A rota exige CRON_SECRET; o mailer é mockado.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/server/email/mailer";
import { sendRecruiterDigests } from "@/server/jobs/digest";
import { GET, POST } from "@/app/api/internal/recruiter-digest/route";
import type { ProcessStageType } from "@prisma/client";

vi.mock("@/server/email/mailer", () => ({ sendMail: vi.fn(async () => {}) }));

const DAY = 86_400_000;
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY);

async function createRecruiter(name: string) {
  return prisma.user.create({ data: { name, email: `rec-${Math.random()}@example.com`, role: "RECRUITER" } });
}

async function createJob(createdById: string, title: string, stageType: ProcessStageType = "HR_INTERVIEW", status: "PUBLISHED" | "CLOSED" = "PUBLISHED") {
  const job = await prisma.job.create({
    data: {
      title,
      description: "Descrição",
      company: "3aq",
      location: "Remoto",
      workMode: "REMOTE",
      seniority: "JUNIOR",
      technologies: ["TypeScript"],
      minimumRequirements: "TypeScript",
      status,
      publishedAt: daysAgo(30),
      createdById,
    },
  });
  const config = stageType === "CODE_TEST" ? { timeLimitMinutes: 60 } : {};
  const stage = await prisma.processStage.create({ data: { jobId: job.id, type: stageType, order: 0, config } });
  return { job, stage };
}

async function stalledFor(jobId: string, stageId: string, name: string, days: number) {
  const user = await prisma.user.create({ data: { name, email: `c-${Math.random()}@example.com`, role: "CANDIDATE" } });
  const candidate = await prisma.candidate.create({ data: { userId: user.id } });
  const resume = await prisma.resume.create({
    data: { candidateId: candidate.id, storageKey: `r/${candidate.id}`, originalFilename: "cv.pdf", mimeType: "application/pdf", sizeBytes: 1 },
  });
  const application = await prisma.application.create({
    data: { candidateId: candidate.id, jobId, resumeId: resume.id, currentStageId: stageId, status: "IN_PROGRESS" },
  });
  await prisma.applicationStageHistory.create({ data: { applicationId: application.id, stageId, enteredAt: daysAgo(days) } });
  return application;
}

function cronRequest(method: "GET" | "POST", authorization?: string) {
  return new NextRequest("http://localhost/api/internal/recruiter-digest", {
    method,
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  vi.mocked(sendMail).mockClear();
  vi.stubEnv("NEXTAUTH_URL", "https://cltech.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("sendRecruiterDigests (US3)", () => {
  it("um único e-mail por recrutador, agrupado por vaga, com link para cada relatório", async () => {
    const ana = await createRecruiter("Ana Souza");
    const bruno = await createRecruiter("Bruno Lima");
    const backend = await createJob(ana.id, "Backend Júnior");
    const frontend = await createJob(ana.id, "Frontend Pleno");
    const dados = await createJob(bruno.id, "Dados");
    const a1 = await stalledFor(backend.job.id, backend.stage.id, "Carla", 12);
    const a2 = await stalledFor(backend.job.id, backend.stage.id, "Diego", 9);
    const a3 = await stalledFor(frontend.job.id, frontend.stage.id, "Elisa", 8);
    await stalledFor(dados.job.id, dados.stage.id, "Fábio", 10);
    // Não entram: dentro do limite, vaga encerrada e teste de código esperando o candidato.
    await stalledFor(backend.job.id, backend.stage.id, "Recente", 3);
    const closed = await createJob(ana.id, "Encerrada", "HR_INTERVIEW", "CLOSED");
    await stalledFor(closed.job.id, closed.stage.id, "Da encerrada", 20);
    const codeTest = await createJob(ana.id, "Com teste", "CODE_TEST");
    await stalledFor(codeTest.job.id, codeTest.stage.id, "Fazendo o teste", 9);

    const result = await sendRecruiterDigests({ now });
    expect(result).toEqual({ recruiters: 2, candidates: 4 });
    expect(sendMail).toHaveBeenCalledTimes(2);

    const toAna = vi.mocked(sendMail).mock.calls.map(([m]) => m).find((m) => m.to === ana.email)!;
    expect(toAna.subject).toBe("3 candidatos aguardando você");
    expect(toAna.text).toContain("Olá, Ana!");
    // Agrupado por vaga, mais antigo primeiro dentro da vaga.
    expect(toAna.text.indexOf("Backend Júnior:")).toBeLessThan(toAna.text.indexOf("Carla"));
    expect(toAna.text.indexOf("Carla")).toBeLessThan(toAna.text.indexOf("Diego"));
    expect(toAna.text.indexOf("Diego")).toBeLessThan(toAna.text.indexOf("Frontend Pleno:"));
    expect(toAna.text.indexOf("Frontend Pleno:")).toBeLessThan(toAna.text.indexOf("Elisa"));
    for (const [job, app] of [[backend.job.id, a1.id], [backend.job.id, a2.id], [frontend.job.id, a3.id]] as const) {
      const url = `https://cltech.test/recrutamento/vagas/${job}/candidaturas/${app}`;
      expect(toAna.text).toContain(url);
      expect(toAna.html).toContain(url);
    }
    for (const absent of ["Recente", "Da encerrada", "Fazendo o teste", "Fábio"]) expect(toAna.text).not.toContain(absent);

    const toBruno = vi.mocked(sendMail).mock.calls.map(([m]) => m).find((m) => m.to === bruno.email)!;
    expect(toBruno.subject).toBe("1 candidato aguardando você");
    expect(toBruno.text).toContain("Fábio");
  });

  it("recrutador sem nada parado não recebe e-mail", async () => {
    const ana = await createRecruiter("Ana");
    const { job, stage } = await createJob(ana.id, "Vaga");
    await stalledFor(job.id, stage.id, "Recente", 2);

    expect(await sendRecruiterDigests({ now })).toEqual({ recruiters: 0, candidates: 0 });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("com SMTP desligado a varredura termina sem erro", async () => {
    // O mailer de verdade: tests/integration/env.ts deixa SMTP_HOST vazio, então ele não envia nada.
    const real = await vi.importActual<typeof import("@/server/email/mailer")>("@/server/email/mailer");
    expect(real.isMailEnabled()).toBe(false);
    vi.mocked(sendMail).mockImplementation(real.sendMail);
    const ana = await createRecruiter("Ana");
    const { job, stage } = await createJob(ana.id, "Vaga");
    await stalledFor(job.id, stage.id, "Parado", 9);

    await expect(sendRecruiterDigests({ now })).resolves.toEqual({ recruiters: 1, candidates: 1 });
    vi.mocked(sendMail).mockImplementation(async () => {});
  });

  it("STALLED_CANDIDATE_DAYS muda o limite do resumo", async () => {
    vi.stubEnv("STALLED_CANDIDATE_DAYS", "2");
    const ana = await createRecruiter("Ana");
    const { job, stage } = await createJob(ana.id, "Vaga");
    await stalledFor(job.id, stage.id, "Três dias", 3);

    expect(await sendRecruiterDigests({ now })).toEqual({ recruiters: 1, candidates: 1 });
    expect(vi.mocked(sendMail).mock.calls[0]![0].text).toContain("há mais de 2 dias na mesma etapa");
  });
});

describe("rota /api/internal/recruiter-digest (FR-1005)", () => {
  async function seedOne() {
    const ana = await createRecruiter("Ana");
    const { job, stage } = await createJob(ana.id, "Vaga");
    await stalledFor(job.id, stage.id, "Parado", 9);
  }

  it("sem Authorization: Bearer $CRON_SECRET devolve 401 e nada é enviado", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    await seedOne();
    for (const req of [cronRequest("POST"), cronRequest("GET", "Bearer errado"), cronRequest("POST", "s3cr3t")]) {
      const res = req.method === "GET" ? await GET(req) : await POST(req);
      expect(res.status).toBe(401);
    }
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sem CRON_SECRET configurado a rota fica desligada", async () => {
    vi.stubEnv("CRON_SECRET", "");
    await seedOne();
    const res = await POST(cronRequest("POST", "Bearer "));
    expect(res.status).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("com o segredo, GET (cron da Vercel) e POST enviam o resumo", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    await seedOne();
    const res = await GET(cronRequest("GET", "Bearer s3cr3t"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recruiters: 1, candidates: 1 });
    expect(sendMail).toHaveBeenCalledTimes(1);

    const again = await POST(cronRequest("POST", "Bearer s3cr3t"));
    expect(again.status).toBe(200);
  });
});
