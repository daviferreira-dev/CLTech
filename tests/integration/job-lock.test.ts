// FR-041: vaga publicada trava tecnologias, requisitos mínimos e etapas do pipeline.
// title/description/location continuam editáveis mesmo publicada.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createJob, setStages, publishJob, updateDraftJob } from "@/server/jobs/builder";
import { ApiError } from "@/lib/errors";

async function createDraftJob() {
  const recruiter = await prisma.user.create({
    data: { name: "Recrutador Teste", email: `recrutador-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
  return createJob(recruiter.id, {
    title: "Vaga de Teste",
    description: "Descrição",
    company: "3aq",
    location: "Remoto",
    workMode: "REMOTE",
    seniority: "JUNIOR",
    technologies: ["TypeScript"],
    minimumRequirements: "TypeScript",
  });
}

async function createPublishedJob() {
  const recruiter = await prisma.user.create({
    data: { name: "Recrutador Teste", email: `recrutador-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
  const job = await createJob(recruiter.id, {
    title: "Vaga de Teste",
    description: "Descrição",
    company: "3aq",
    location: "Remoto",
    workMode: "REMOTE",
    seniority: "JUNIOR",
    technologies: ["TypeScript"],
    minimumRequirements: "TypeScript",
  });
  await setStages(job.id, { stages: [{ type: "RESUME_ANALYSIS" }] });
  return publishJob(job.id);
}

describe("updateDraftJob em vaga PUBLISHED (FR-041)", () => {
  it("recusa alterar technologies", async () => {
    const job = await createPublishedJob();
    await expect(updateDraftJob(job.id, { technologies: ["Python"] })).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).code).toBe("JOB_LOCKED");
      return true;
    });
  });

  it("recusa alterar minimumRequirements", async () => {
    const job = await createPublishedJob();
    await expect(updateDraftJob(job.id, { minimumRequirements: "Outra coisa" })).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).code).toBe("JOB_LOCKED");
      return true;
    });
  });

  it("permite alterar title/description/location", async () => {
    const job = await createPublishedJob();
    const updated = await updateDraftJob(job.id, { title: "Novo Título", description: "Nova descrição", location: "SP" });
    expect(updated.title).toBe("Novo Título");
    expect(updated.technologies).toEqual(["TypeScript"]); // intocado
  });
});

describe("setStages em vaga PUBLISHED (FR-041)", () => {
  it("recusa substituir as etapas", async () => {
    const job = await createPublishedJob();
    await expect(setStages(job.id, { stages: [{ type: "GITHUB_ANALYSIS" }] })).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).code).toBe("JOB_LOCKED");
      return true;
    });

    const stages = await prisma.processStage.findMany({ where: { jobId: job.id } });
    expect(stages).toHaveLength(1);
    expect(stages[0]?.type).toBe("RESUME_ANALYSIS");
  });
});

// Dois PUT /stages sobrepostos (cliques rápidos em "Adicionar etapa") entrelaçavam o
// delete de um com o insert do outro e estouravam o índice único (jobId, order),
// gravando um pipeline pela metade. Encontrado rodando o E2E do Fluxo 2.
describe("setStages concorrente (FR-039, FR-042)", () => {
  it("duas substituições simultâneas deixam o pipeline íntegro, nunca parcial", async () => {
    const job = await createDraftJob();

    const results = await Promise.allSettled([
      setStages(job.id, { stages: [{ type: "RESUME_ANALYSIS" }] }),
      setStages(job.id, { stages: [{ type: "RESUME_ANALYSIS" }, { type: "GITHUB_ANALYSIS" }] }),
    ]);

    expect(results.some((r) => r.status === "fulfilled")).toBe(true);

    const stages = await prisma.processStage.findMany({
      where: { jobId: job.id },
      orderBy: { order: "asc" },
    });

    // O resultado tem de ser exatamente um dos dois pipelines enviados — nunca uma mistura.
    const types = stages.map((s) => s.type);
    expect([["RESUME_ANALYSIS"], ["RESUME_ANALYSIS", "GITHUB_ANALYSIS"]]).toContainEqual(types);
    // E a ordem continua densa a partir de 0.
    expect(stages.map((s) => s.order)).toEqual(types.map((_, i) => i));
  });
});
