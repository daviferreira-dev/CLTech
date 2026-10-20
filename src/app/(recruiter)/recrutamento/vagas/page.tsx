import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { JobsManagerList } from "./JobsManagerList";

export default async function VagasRecrutadorPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requirePageRole(RECRUITER_ROLES, currentPath("/recrutamento/vagas", await searchParams));

  return (
    <PageContainer className="max-w-5xl">
      <JobsManagerList />
    </PageContainer>
  );
}
