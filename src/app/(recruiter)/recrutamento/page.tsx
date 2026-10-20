import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { Dashboard } from "./Dashboard";

export default async function RecrutamentoPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requirePageRole(RECRUITER_ROLES, currentPath("/recrutamento", await searchParams));

  return (
    <PageContainer>
      <Dashboard />
    </PageContainer>
  );
}
