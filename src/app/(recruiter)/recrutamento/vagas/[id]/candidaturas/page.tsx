import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { recruiterTitle, requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { CardListSkeleton } from "@/components/ui";
import { CandidatesForJobList } from "./CandidatesForJobList";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return recruiterTitle(() => prisma.job.findUnique({ where: { id }, select: { title: true } }), "Candidaturas", (job) => `Candidaturas · ${job.title}`);
}

export default async function CandidaturasDaVagaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { id } = await params;
  await requirePageRole(RECRUITER_ROLES, currentPath(`/recrutamento/vagas/${id}/candidaturas`, await searchParams));

  // "Tempo na etapa" (spec 004 US5.2) não sai de GET /applications, e a sprint não muda
  // contrato de API: a entrada na etapa atual é lida aqui, do histórico append-only.
  const openEntries = await prisma.applicationStageHistory.findMany({
    where: { exitedAt: null, application: { jobId: id } },
    select: { applicationId: true, enteredAt: true },
  });
  const enteredAtById = Object.fromEntries(openEntries.map((entry) => [entry.applicationId, entry.enteredAt.toISOString()]));

  return (
    <PageContainer className="max-w-5xl">
      <Suspense fallback={<CardListSkeleton />}>
        <CandidatesForJobList jobId={id} enteredAtById={enteredAtById} />
      </Suspense>
    </PageContainer>
  );
}
