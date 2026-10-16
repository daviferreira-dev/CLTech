// RN002: vaga só publica completa — tecnologias, requisitos mínimos e ao menos uma etapa.
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createJob, setStages, publishJob } from "@/server/jobs/builder";
import { ApiError } from "@/lib/errors";

async function createRecruiter() {
  return prisma.user.create({
    data: { name: "Recrutador Teste", email: `recrutador-${Date.now()}-${Math.random()}@example.com`, role: "RECRUITER" },
  });
}

const BASE_INPUT = {
  title: "Vaga de Teste",
  description: "Descrição",
  company: "3aq",
  location: "Remoto",
  workMode: "REMOTE" as const,
  seniority: "JUNIOR" as const,
  minimumRequirements: "TypeScript",
};

describe("publishJob (RN002)", () => {
  it("recusa publicar sem tecnologias", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, { ...BASE_INPUT, technologies: [] });
    await setStages(job.id, { stages: [{ type: "RESUME_ANALYSIS" }] });

    await expect(publishJob(job.id)).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).code).toBe("INCOMPLETE_JOB");
      expect((err as { details?: { missing?: string[] } }).details?.missing).toContain("technologies");
      return true;
    });
  });

  it("recusa publicar sem requisitos mínimos", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, { ...BASE_INPUT, technologies: ["TypeScript"], minimumRequirements: "" });
    await setStages(job.id, { stages: [{ type: "RESUME_ANALYSIS" }] });

    await expect(publishJob(job.id)).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).code).toBe("INCOMPLETE_JOB");
      return true;
    });
  });

  it("recusa publicar sem nenhuma etapa", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, { ...BASE_INPUT, technologies: ["TypeScript"] });

    await expect(publishJob(job.id)).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).code).toBe("INCOMPLETE_JOB");
      expect((err as { details?: { missing?: string[] } }).details?.missing).toContain("stages");
      return true;
    });
  });

  it("recusa publicar com as três faltando ao mesmo tempo", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, { ...BASE_INPUT, technologies: [], minimumRequirements: "" });

    await expect(publishJob(job.id)).rejects.toSatisfy((err: unknown) => {
      const missing = (err as { details?: { missing?: string[] } }).details?.missing ?? [];
      expect(missing).toEqual(["technologies", "minimumRequirements", "stages"]);
      return true;
    });
  });

  it("publica quando tecnologias, requisitos e etapa existem", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, { ...BASE_INPUT, technologies: ["TypeScript"] });
    await setStages(job.id, { stages: [{ type: "RESUME_ANALYSIS" }] });

    const published = await publishJob(job.id);
    expect(published.status).toBe("PUBLISHED");
  });

  it("recusa publicar de novo uma vaga já publicada (409)", async () => {
    const recruiter = await createRecruiter();
    const job = await createJob(recruiter.id, { ...BASE_INPUT, technologies: ["TypeScript"] });
    await setStages(job.id, { stages: [{ type: "RESUME_ANALYSIS" }] });
    await publishJob(job.id);

    await expect(publishJob(job.id)).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).status).toBe(409);
      return true;
    });
  });
});
