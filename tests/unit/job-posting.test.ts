import { describe, it, expect } from "vitest";
import { buildJobPosting, serializeJsonLd, type JobPostingInput } from "@/lib/jobPosting";

const base: JobPostingInput = {
  title: "Desenvolvedor(a) Backend Node.js",
  description: "API em Node e Postgres.",
  company: "3aq Tecnologia",
  location: "Fortaleza, CE",
  workMode: "HYBRID",
  seniority: "MID",
  status: "PUBLISHED",
  publishedAt: new Date("2026-11-01T12:00:00.000Z"),
  createdAt: new Date("2026-10-20T12:00:00.000Z"),
};

describe("buildJobPosting", () => {
  it("vaga híbrida/presencial: campos do Google e endereço com cidade e UF", () => {
    expect(buildJobPosting(base)).toEqual({
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      title: base.title,
      description: base.description,
      datePosted: "2026-11-01T12:00:00.000Z",
      hiringOrganization: { "@type": "Organization", name: "3aq Tecnologia" },
      jobLocation: {
        "@type": "Place",
        address: { "@type": "PostalAddress", addressLocality: "Fortaleza", addressRegion: "CE", addressCountry: "BR" },
      },
    });
  });

  it("vaga remota: TELECOMMUTE com Brasil, sem jobLocation", () => {
    const posting = buildJobPosting({ ...base, workMode: "REMOTE" })!;
    expect(posting.jobLocationType).toBe("TELECOMMUTE");
    expect(posting.applicantLocationRequirements).toEqual({ "@type": "Country", name: "Brasil" });
    expect(posting).not.toHaveProperty("jobLocation");
  });

  it("estágio vira INTERN; outros níveis não inventam employmentType; nunca há salário", () => {
    expect(buildJobPosting({ ...base, seniority: "INTERN" })!.employmentType).toBe("INTERN");
    const mid = buildJobPosting(base)!;
    expect(mid).not.toHaveProperty("employmentType");
    expect(mid).not.toHaveProperty("baseSalary");
  });

  it("local fora do padrão cidade/UF vai inteiro; sem publishedAt usa createdAt", () => {
    const posting = buildJobPosting({ ...base, workMode: "ONSITE", location: "Centro de Fortaleza", publishedAt: null })!;
    expect((posting.jobLocation as { address: unknown }).address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Centro de Fortaleza",
      addressCountry: "BR",
    });
    expect(posting.datePosted).toBe("2026-10-20T12:00:00.000Z");
  });

  it("descrição vira HTML: escapa & < > e troca quebra de linha por <br>", () => {
    const posting = buildJobPosting({ ...base, description: "Node & Postgres\n<b>sênior</b>\r\nfim" })!;
    expect(posting.description).toBe("Node &amp; Postgres<br>&lt;b&gt;sênior&lt;/b&gt;<br>fim");
  });

  it("rascunho e vaga encerrada não geram o bloco", () => {
    expect(buildJobPosting({ ...base, status: "DRAFT" })).toBeNull();
    expect(buildJobPosting({ ...base, status: "CLOSED" })).toBeNull();
  });
});

describe("serializeJsonLd", () => {
  it("escapa < para o texto do recrutador não fechar o <script>", () => {
    const evil = buildJobPosting({ ...base, title: '</script><script>alert(1)</script>', description: "<!-- x" })!;
    const json = serializeJsonLd(evil);
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script>");
    // Continua JSON válido e devolve o texto original.
    expect(JSON.parse(json).title).toBe('</script><script>alert(1)</script>');
  });

  it("no HTML da página sobra um único </script>, o do próprio bloco", () => {
    const json = serializeJsonLd(buildJobPosting({ ...base, title: "</script><script>alert(1)</script>" }));
    const html = `<script type="application/ld+json">${json}</script>`;
    expect(html.match(/<\/script>/gi)).toHaveLength(1);
  });
});
