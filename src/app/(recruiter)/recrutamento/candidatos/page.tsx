import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/AppShell";
import { CardListSkeleton } from "@/components/ui";
import { CandidateSearch } from "./CandidateSearch";

export const metadata = { title: "Candidatos" };

export default async function CandidatosPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requirePageRole(RECRUITER_ROLES, currentPath("/recrutamento/candidatos", await searchParams));

  return (
    <PageContainer className="max-w-4xl">
      <Suspense fallback={<CardListSkeleton count={2} />}>
        <CandidateSearch />
      </Suspense>
    </PageContainer>
  );
}
