import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { JobBuilder } from "@/components/recruiter/JobBuilder";

export default async function EditarVagaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { id } = await params;
  await requirePageRole(RECRUITER_ROLES, currentPath(`/recrutamento/vagas/${id}`, await searchParams));

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Editar Vaga" />
      <JobBuilder jobId={id} />
    </PageContainer>
  );
}
