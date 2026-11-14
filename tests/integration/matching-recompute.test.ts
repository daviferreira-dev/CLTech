// FR-034: recálculo de JobMatch nos gatilhos (currículo novo, GitHub sincronizado),
// e a leitura de GET /api/jobs só calcula o que falta, sem alterar o que já existe (RN003).
import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { encrypt } from "@/server/crypto";
import { recomputeJobMatchesForCandidate, recomputeJobMatchesForJob } from "@/server/matching/recompute";
import { listPublishedJobs } from "@/server/jobs/list";
import { getJobDetail } from "@/server/jobs/detail";

async function createPublishedJob(technologies: string[]) {
  const recruiter = await prisma.user.create({
    data: { name: "Recrutador Teste", email: `recrutador-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
  return prisma.job.create({
    data: {
      title: "Vaga de Teste",
      description: "Descrição",
      company: "3aq",
      location: "Remoto",
      workMode: "REMOTE",
      seniority: "JUNIOR",
      technologies,
      minimumRequirements: technologies.join(", "),
      status: "PUBLISHED",
      publishedAt: new Date(),
      createdById: recruiter.id,
      stages: { create: [{ type: "RESUME_ANALYSIS", order: 0, config: {} }] },
    },
  });
}

async function createCandidateWithResume(email: string, extractedText: string) {
  const user = await registerCandidate({ name: "Candidato Teste", email, password: "senhaSegura123" });
  const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
  await prisma.resume.create({
    data: {
      candidateId: candidate.id,
      storageKey: `resumes/${candidate.id}/cv.pdf`,
      originalFilename: "cv.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      isCurrent: true,
      extractedText: encrypt(extractedText),
      parseStatus: "PARSED",
    },
  });
  return { user, candidate };
}

describe("recomputeJobMatchesForCandidate (FR-034, gatilho 1-2)", () => {
  it("cria JobMatch com score e justificativa para toda vaga publicada", async () => {
    const job = await createPublishedJob(["React", "Node", "Docker"]);
    const { candidate } = await createCandidateWithResume(
      `match-${Date.now()}@example.com`,
      "Experiência com React e Node.",
    );

    await recomputeJobMatchesForCandidate(candidate.id);

    const match = await prisma.jobMatch.findUnique({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });
    expect(match).not.toBeNull();
    expect(match?.score).toBe(67); // só currículo, 2/3 tecnologias
    expect(match?.justification).toEqual({ matched: ["React", "Node"], missing: ["Docker"] });
  });

  it("não cria JobMatch quando o candidato não tem currículo vigente nem GitHub", async () => {
    const job = await createPublishedJob(["React"]);
    const user = await registerCandidate({ name: "Sem Currículo", email: `semcv-${Date.now()}@example.com`, password: "senhaSegura123" });
    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });

    await recomputeJobMatchesForCandidate(candidate.id);

    const match = await prisma.jobMatch.findUnique({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });
    expect(match).toBeNull();
    void job;
  });

  it("recalcula (não duplica) quando chamado de novo após o currículo mudar", async () => {
    const job = await createPublishedJob(["React", "Vue"]);
    const { candidate } = await createCandidateWithResume(`recalc-${Date.now()}@example.com`, "Só React.");
    await recomputeJobMatchesForCandidate(candidate.id);

    const before = await prisma.jobMatch.findUniqueOrThrow({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });
    expect(before.score).toBe(50);

    await prisma.resume.updateMany({ where: { candidateId: candidate.id }, data: { isCurrent: false } });
    await prisma.resume.create({
      data: {
        candidateId: candidate.id,
        storageKey: `resumes/${candidate.id}/cv2.pdf`,
        originalFilename: "cv2.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        isCurrent: true,
        extractedText: encrypt("React e Vue, as duas."),
        parseStatus: "PARSED",
      },
    });

    await recomputeJobMatchesForCandidate(candidate.id);

    const after = await prisma.jobMatch.findUniqueOrThrow({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });
    expect(after.score).toBe(100);
    expect(await prisma.jobMatch.count({ where: { candidateId: candidate.id, jobId: job.id } })).toBe(1);
  });
});

describe("recomputeJobMatchesForJob (FR-034, gatilho 3)", () => {
  it("cria JobMatch para todo candidato com currículo vigente", async () => {
    const { candidate: c1 } = await createCandidateWithResume(`c1-${Date.now()}@example.com`, "React.");
    const { candidate: c2 } = await createCandidateWithResume(`c2-${Date.now()}@example.com`, "Nada relevante aqui.");
    const job = await createPublishedJob(["React"]);

    await recomputeJobMatchesForJob(job.id);

    const matches = await prisma.jobMatch.findMany({ where: { jobId: job.id } });
    expect(matches).toHaveLength(2);
    expect(matches.find((m) => m.candidateId === c1.id)?.score).toBe(100);
    expect(matches.find((m) => m.candidateId === c2.id)?.score).toBe(0);
  });
});

describe("GET /api/jobs não recalcula no caminho de leitura (D3 da Sprint 1)", () => {
  it("leitura repetida da listagem não cria nem altera JobMatch", async () => {
    const job = await createPublishedJob(["React"]);
    const { user, candidate } = await createCandidateWithResume(`leitura-${Date.now()}@example.com`, "React.");
    await recomputeJobMatchesForCandidate(candidate.id);

    const before = await prisma.jobMatch.findUniqueOrThrow({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });

    await listPublishedJobs({ page: 1, pageSize: 20 }, user.id);
    await listPublishedJobs({ page: 1, pageSize: 20 }, user.id);

    const after = await prisma.jobMatch.findUniqueOrThrow({
      where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } },
    });
    expect(after.computedAt).toEqual(before.computedAt);
  });
});

describe("compatibilidade que falta é calculada na leitura (sem recalcular o que existe)", () => {
  it("lista: calcula a vaga sem linha, grava, e não mexe na que já tinha", async () => {
    const jobOld = await createPublishedJob(["React"]);
    const jobNew = await createPublishedJob(["React", "Docker"]);
    const { user, candidate } = await createCandidateWithResume(`falta-${Date.now()}@example.com`, "React.");
    await prisma.jobMatch.create({
      data: { candidateId: candidate.id, jobId: jobOld.id, score: 42, justification: { matched: [], missing: [] } },
    });

    const result = await listPublishedJobs({ page: 1, pageSize: 50 }, user.id);

    const byId = new Map(result.items.map((item) => [item.id, item.matchScore]));
    expect(byId.get(jobOld.id)).toEqual({ status: "CALCULATED", value: 42 }); // RN003: intacto
    expect(byId.get(jobNew.id)).toEqual({ status: "CALCULATED", value: 50 });
    expect(await prisma.jobMatch.count({ where: { candidateId: candidate.id, jobId: jobNew.id } })).toBe(1);
  });

  it("detalhe: calcula na hora e devolve o que casou e o que falta", async () => {
    const job = await createPublishedJob(["React", "Docker"]);
    const { user } = await createCandidateWithResume(`detalhe-${Date.now()}@example.com`, "React.");

    const detail = await getJobDetail(job.id, user.id);

    expect(detail.matchScore).toMatchObject({ status: "CALCULATED", value: 50, matched: ["React"], missing: ["Docker"] });
  });

  it("sem sinal nenhum (currículo sem texto): pede o currículo em vez de ficar calculando", async () => {
    const job = await createPublishedJob(["React"]);
    const user = await registerCandidate({ name: "Sem Sinal", email: `semsinal-${Date.now()}@example.com`, password: "senhaSegura123" });
    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
    await prisma.resume.create({
      data: {
        candidateId: candidate.id,
        storageKey: `resumes/${candidate.id}/cv.pdf`,
        originalFilename: "cv.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        isCurrent: true,
      },
    });

    const result = await listPublishedJobs({ page: 1, pageSize: 50 }, user.id);

    expect(result.items.find((item) => item.id === job.id)?.matchScore).toEqual({ status: "NEEDS_RESUME" });
    expect(await prisma.jobMatch.count({ where: { candidateId: candidate.id } })).toBe(0);
  });
});

describe("cálculo na leitura: concorrência, RN003, isolamento e falha de gravação", () => {
  it("duas listagens simultâneas gravam uma linha só e não lançam", async () => {
    const job = await createPublishedJob(["React"]);
    const { user, candidate } = await createCandidateWithResume(`conc-${Date.now()}@example.com`, "React.");

    const [a, b] = await Promise.all([
      listPublishedJobs({ page: 1, pageSize: 50 }, user.id),
      listPublishedJobs({ page: 1, pageSize: 50 }, user.id),
    ]);

    expect(a.items.find((i) => i.id === job.id)?.matchScore).toEqual({ status: "CALCULATED", value: 100 });
    expect(b.items.find((i) => i.id === job.id)?.matchScore).toEqual({ status: "CALCULATED", value: 100 });
    expect(await prisma.jobMatch.count({ where: { candidateId: candidate.id, jobId: job.id } })).toBe(1);
  });

  it("detalhe mostra o score já emitido, mesmo que o motor hoje desse outro (RN003)", async () => {
    const job = await createPublishedJob(["React"]);
    const { user, candidate } = await createCandidateWithResume(`rn003-${Date.now()}@example.com`, "React.");
    await prisma.jobMatch.create({
      data: { candidateId: candidate.id, jobId: job.id, score: 42, justification: { matched: [], missing: ["React"] } },
    });

    const detail = await getJobDetail(job.id, user.id);

    expect(detail.matchScore).toMatchObject({ status: "CALCULATED", value: 42, missing: ["React"] });
  });

  it("um candidato não grava nem vê a compatibilidade de outro", async () => {
    const job = await createPublishedJob(["React"]);
    const a = await createCandidateWithResume(`iso-a-${Date.now()}@example.com`, "React.");
    const b = await createCandidateWithResume(`iso-b-${Date.now()}@example.com`, "Nada relevante.");

    const listA = await listPublishedJobs({ page: 1, pageSize: 50 }, a.user.id);
    const listB = await listPublishedJobs({ page: 1, pageSize: 50 }, b.user.id);

    expect(listA.items.find((i) => i.id === job.id)?.matchScore).toEqual({ status: "CALCULATED", value: 100 });
    expect(listB.items.find((i) => i.id === job.id)?.matchScore).toEqual({ status: "CALCULATED", value: 0 });
    expect((await prisma.jobMatch.findMany({ where: { jobId: job.id } })).map((m) => [m.candidateId, m.score]).sort()).toEqual(
      [[a.candidate.id, 100], [b.candidate.id, 0]].sort(),
    );
  });

  it("falha ao gravar o cache não derruba a listagem: devolve o calculado", async () => {
    const job = await createPublishedJob(["React"]);
    const { user } = await createCandidateWithResume(`falha-${Date.now()}@example.com`, "React.");
    const spy = vi.spyOn(prisma.jobMatch, "createMany").mockRejectedValueOnce(new Error("timeout simulado"));

    const result = await listPublishedJobs({ page: 1, pageSize: 50 }, user.id);
    spy.mockRestore();

    expect(result.items.find((i) => i.id === job.id)?.matchScore).toEqual({ status: "CALCULATED", value: 100 });
  });
});
