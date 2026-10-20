import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { ApplicationDetailView } from "./ApplicationDetailView";

export default async function CandidaturaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; applicationId: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { id, applicationId } = await params;
  await requirePageRole(
    RECRUITER_ROLES,
    currentPath(`/recrutamento/vagas/${id}/candidaturas/${applicationId}`, await searchParams),
  );

  return (
    <PageContainer className="max-w-5xl">
      <ApplicationDetailView jobId={id} applicationId={applicationId} />
    </PageContainer>
  );
}
