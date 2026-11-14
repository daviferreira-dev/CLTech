import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/server/auth/config";
import { buildJobPosting, serializeJsonLd } from "@/lib/jobPosting";
import { PageContainer } from "@/components/layout/AppShell";
import { JobDetail } from "./JobDetail";

// Só vaga publicada: rascunho não vaza pelo <title> nem pelo JSON-LD. cache() faz uma consulta
// só por requisição para os metadados e a página.
const getPublishedJob = cache((id: string) =>
  prisma.job.findFirst({
    where: { id, status: "PUBLISHED" },
    select: {
      title: true,
      description: true,
      company: true,
      location: true,
      workMode: true,
      seniority: true,
      status: true,
      publishedAt: true,
      createdAt: true,
    },
  }),
);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getPublishedJob(id);
  return { title: job?.title ?? "Vaga" };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, job] = await Promise.all([auth(), getPublishedJob(id)]);
  const viewer = session?.user?.role === "CANDIDATE" ? "candidate" : session?.user ? "staff" : "visitor";
  const jobPosting = job ? buildJobPosting(job) : null;

  return (
    // Espaço para a barra fixa de ação no mobile não cobrir o fim do conteúdo (spec 003 US4.2).
    <PageContainer className="pb-28 lg:pb-10">
      {jobPosting && (
        // Bloco de dados, não executa: a CSP (script-src) não se aplica e não precisa de nonce.
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jobPosting) }} />
      )}
      <JobDetail jobId={id} viewer={viewer} />
    </PageContainer>
  );
}
