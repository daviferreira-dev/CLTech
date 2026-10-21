// Spec 007 — perfil profissional: PATCH substitui listas, validação, match e export LGPD.
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerCandidate } from "@/server/auth/register";
import { getProfile, updateProfile } from "@/server/candidates/profile";
import { exportMyData } from "@/server/candidates/privacy";
import { getCandidateSignals } from "@/server/matching/recompute";
import { updateProfileSchema } from "@/lib/validation/profile";

async function candidate(name = "Ana") {
  return registerCandidate({ name, email: `${name.toLowerCase()}-${Date.now()}-${Math.random()}@example.com`, password: "senhaSegura123" });
}

const FULL = updateProfileSchema.parse({
  headline: "Dev Backend",
  summary: "Cinco anos com APIs.",
  technologies: ["Node.js", "React"],
  softSkills: ["Comunicação"],
  experiences: [
    { company: "Acme", role: "Dev", startDate: "2021-03", endDate: null, isCurrent: true, description: null },
    { company: "Beta", role: "Júnior", startDate: "2019-01", endDate: "2021-02", isCurrent: false, description: "APIs" },
  ],
  educations: [
    { institution: "USP", course: "Computação", level: "GRADUACAO", startDate: "2015-01", endDate: "2018-12", inProgress: false },
  ],
  languages: [{ name: "Inglês", level: "AVANCADO" }],
  links: [{ label: "Portfólio", url: "https://ana.dev" }],
});

describe("perfil profissional (spec 007)", () => {
  it("grava e devolve todos os blocos na ordem enviada", async () => {
    const user = await candidate();
    await updateProfile(user.id, FULL);
    const { details } = await getProfile(user.id);
    expect(details.headline).toBe("Dev Backend");
    expect(details.experiences.map((e) => e.company)).toEqual(["Acme", "Beta"]);
    expect(details.experiences[0]).toMatchObject({ startDate: "2021-03", endDate: null, isCurrent: true });
    expect(details.educations[0]).toMatchObject({ level: "GRADUACAO", endDate: "2018-12" });
    expect(details.languages).toEqual([{ name: "Inglês", level: "AVANCADO" }]);
    expect(details.links).toEqual([{ label: "Portfólio", url: "https://ana.dev" }]);
  });

  it("lista enviada substitui a anterior; lista omitida não muda", async () => {
    const user = await candidate();
    await updateProfile(user.id, FULL);
    await updateProfile(user.id, { experiences: [], city: "Campinas" });
    const { details, city } = await getProfile(user.id);
    expect(city).toBe("Campinas");
    expect(details.experiences).toEqual([]);
    expect(details.educations).toHaveLength(1);
  });

  it("um candidato não toca as listas de outro", async () => {
    const ana = await candidate("Ana");
    const bia = await candidate("Bia");
    await updateProfile(ana.id, FULL);
    await updateProfile(bia.id, { experiences: [] });
    expect((await getProfile(ana.id)).details.experiences).toHaveLength(2);
  });

  it("rejeita fim antes do início, link sem https e nível ausente", () => {
    const bad = (body: unknown) => updateProfileSchema.safeParse(body).success;
    expect(bad({ experiences: [{ company: "A", role: "B", startDate: "2022-01", endDate: "2021-01", isCurrent: false, description: null }] })).toBe(false);
    expect(bad({ links: [{ label: "Site", url: "http://ana.dev" }] })).toBe(false);
    expect(bad({ languages: [{ name: "Inglês", level: "" }] })).toBe(false);
  });

  it("tecnologias do perfil entram no sinal de currículo do match (FR-708)", async () => {
    const user = await candidate();
    await updateProfile(user.id, { technologies: ["React"] });
    const c = await prisma.candidate.findUniqueOrThrow({ where: { userId: user.id } });
    expect((await getCandidateSignals(c.id)).resumeText).toContain("React");
  });

  it("exportação LGPD inclui o perfil profissional (FR-709)", async () => {
    const user = await candidate();
    await updateProfile(user.id, FULL);
    const data = await exportMyData(user.id);
    expect(data.profile).toMatchObject({ headline: "Dev Backend", technologies: ["Node.js", "React"] });
    expect(data.profile?.experiences).toHaveLength(2);
  });
});
