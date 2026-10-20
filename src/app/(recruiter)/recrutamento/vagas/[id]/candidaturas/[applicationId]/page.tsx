import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { ApplicationDetailView, type ReportOrigin } from "./ApplicationDetailView";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CandidaturaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; applicationId: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { id, applicationId } = await params;
  const query = await searchParams;
  await requirePageRole(RECRUITER_ROLES, currentPath(`/recrutamento/vagas/${id}/candidaturas/${applicationId}`, query));

  // O caminho de volta reflete por onde o recrutador chegou (spec 004 FR-106, US6.2).
  const origin: ReportOrigin =
    first(query.origem) === "busca"
      ? { kind: "search", q: first(query.q) ?? "" }
      : { kind: "job", stage: first(query.etapa) ?? "" };

  return (
    <PageContainer className="max-w-5xl">
      <ApplicationDetailView jobId={id} applicationId={applicationId} origin={origin} />
    </PageContainer>
  );
}
