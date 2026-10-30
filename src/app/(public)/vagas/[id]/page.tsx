import { prisma } from "@/lib/prisma";
import { auth } from "@/server/auth/config";
import { PageContainer } from "@/components/layout/AppShell";
import { JobDetail } from "./JobDetail";

// Só vaga publicada vira título: rascunho não vaza pelo <title>.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findFirst({ where: { id, status: "PUBLISHED" }, select: { title: true } });
  return { title: job?.title ?? "Vaga" };
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const viewer = session?.user?.role === "CANDIDATE" ? "candidate" : session?.user ? "staff" : "visitor";

  return (
    // Espaço para a barra fixa de ação no mobile não cobrir o fim do conteúdo (spec 003 US4.2).
    <PageContainer className="pb-28 lg:pb-10">
      <JobDetail jobId={id} viewer={viewer} />
    </PageContainer>
  );
}
