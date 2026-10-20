import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CandidatesForJobList } from "./CandidatesForJobList";

export default async function CandidaturasDaVagaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { id } = await params;
  await requirePageRole(RECRUITER_ROLES, currentPath(`/recrutamento/vagas/${id}/candidaturas`, await searchParams));

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader title="Candidatos" />
      <CandidatesForJobList jobId={id} />
    </PageContainer>
  );
}
