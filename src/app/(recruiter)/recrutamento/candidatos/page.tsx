import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { CandidateSearch } from "./CandidateSearch";

export default async function CandidatosPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requirePageRole(RECRUITER_ROLES, currentPath("/recrutamento/candidatos", await searchParams));

  return (
    <PageContainer className="max-w-4xl">
      <CandidateSearch />
    </PageContainer>
  );
}
