// FR-014: upload inválido (formato ou tamanho) não substitui o currículo vigente.
import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { uploadResume } from "@/server/candidates/resume";
import { ApiError } from "@/lib/errors";

vi.mock("@/server/storage", () => ({
  uploadPrivateObject: vi.fn(async () => ({ storageKey: "resumes/fake/key.pdf" })),
}));

function pdfBuffer(sizeBytes: number): Buffer {
  const header = Buffer.from("%PDF-1.4\n");
  return Buffer.concat([header, Buffer.alloc(Math.max(0, sizeBytes - header.length))]);
}

describe("uploadResume (FR-014, FR-015)", () => {
  it("aceita um PDF válido e marca como currículo vigente", async () => {
    const user = await registerCandidate({ name: "Teste", email: "pdf@example.com", password: "senhaSegura123" });
    const result = await uploadResume(user.id, {
      name: "cv.pdf",
      type: "application/pdf",
      buffer: pdfBuffer(1024),
    });

    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
    const current = await prisma.resume.findFirst({ where: { candidateId: candidate.id, isCurrent: true } });
    expect(current?.id).toBe(result.id);
  });

  it("recusa arquivo acima de 5 MB (413) e preserva o currículo anterior", async () => {
    const user = await registerCandidate({ name: "Teste", email: "grande@example.com", password: "senhaSegura123" });
    const first = await uploadResume(user.id, { name: "cv.pdf", type: "application/pdf", buffer: pdfBuffer(1024) });

    const oversized = pdfBuffer(6 * 1024 * 1024);
    await expect(
      uploadResume(user.id, { name: "cv-grande.pdf", type: "application/pdf", buffer: oversized }),
    ).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).status).toBe(413);
      return true;
    });

    const candidate = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
    const current = await prisma.resume.findFirst({ where: { candidateId: candidate.id, isCurrent: true } });
    expect(current?.id).toBe(first.id);
  });

  it("recusa formato não suportado (415) mesmo com extensão/MIME declarados como PDF", async () => {
    const user = await registerCandidate({ name: "Teste", email: "fake@example.com", password: "senhaSegura123" });

    const fakeBuffer = Buffer.from("isto nao e um pdf de verdade");
    await expect(
      uploadResume(user.id, { name: "cv.pdf", type: "application/pdf", buffer: fakeBuffer }),
    ).rejects.toSatisfy((err: unknown) => {
      expect((err as ApiError).status).toBe(415);
      return true;
    });
  });
});
