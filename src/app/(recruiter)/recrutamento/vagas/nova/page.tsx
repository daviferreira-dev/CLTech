import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { JobBuilder } from "@/components/recruiter/JobBuilder";

export default async function NovaVagaPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requirePageRole(RECRUITER_ROLES, currentPath("/recrutamento/vagas/nova", await searchParams));

  return (
    <PageContainer className="max-w-4xl">
      <JobBuilder />
    </PageContainer>
  );
}
