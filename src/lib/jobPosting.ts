// Dados estruturados JobPosting (schema.org) da página pública da vaga, no formato que o Google
// lê para a busca de vagas: https://developers.google.com/search/docs/appearance/structured-data/job-posting
// Só o que o modelo Job tem: sem salário, sem validade, sem tipo de contrato inventado.

export interface JobPostingInput {
  title: string;
  description: string;
  company: string;
  location: string;
  workMode: string;
  seniority: string;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
}

/** Objeto JobPosting, ou null quando a vaga não está publicada (rascunho e encerrada não vão ao Google). */
export function buildJobPosting(job: JobPostingInput): Record<string, unknown> | null {
  if (job.status !== "PUBLISHED") return null;

  const place =
    job.workMode === "REMOTE"
      ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "Brasil" } }
      : { jobLocation: { "@type": "Place", address: postalAddress(job.location) } };

  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: textToHtml(job.description),
    datePosted: (job.publishedAt ?? job.createdAt).toISOString(),
    hiringOrganization: { "@type": "Organization", name: job.company.trim() || "3aq Tecnologia" },
    // Só estágio tem equivalente direto; júnior/pleno/sênior é nível, não tipo de contrato.
    ...(job.seniority === "INTERN" ? { employmentType: "INTERN" } : {}),
    ...place,
  };
}

/** O Google lê a descrição como HTML: texto do recrutador escapado, quebra de linha vira <br>. */
function textToHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r?\n/g, "<br>");
}

/** "Fortaleza, CE" vira cidade + UF; qualquer outro texto vai inteiro como cidade. */
function postalAddress(location: string) {
  const text = location.trim();
  const [, city, uf] = /^(.+?),\s*([A-Za-z]{2})$/.exec(text) ?? [];
  return {
    "@type": "PostalAddress",
    ...(city && uf ? { addressLocality: city, addressRegion: uf.toUpperCase() } : text ? { addressLocality: text } : {}),
    addressCountry: "BR",
  };
}

/**
 * JSON para dentro de <script type="application/ld+json">. Título e descrição vêm do recrutador:
 * sem escapar o "<", um "</script>" no texto fecharia o bloco e o resto viraria HTML.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
