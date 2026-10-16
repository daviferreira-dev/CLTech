// FR-041: vaga publicada trava tecnologias, requisitos mínimos e etapas do pipeline.
// title/description/location continuam editáveis mesmo publicada.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createJob, setStages, publishJob, updateDraftJob } from "@/server/jobs/builder";
import { ApiError } from "@/lib/errors";

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
