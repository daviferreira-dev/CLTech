import { Suspense } from "react";
import { auth } from "@/server/auth/config";
import { PageContainer } from "@/components/layout/AppShell";
import { CardListSkeleton } from "@/components/ui";
import { JobsList } from "./JobsList";

export default async function JobsPage() {
  const session = await auth();
  // Só o próprio candidato vê match (FR-035); para ele, ausência de percentual é "calculando".
  const viewer = session?.user?.role === "CANDIDATE" ? "candidate" : session?.user ? "staff" : "visitor";

  return (
    <PageContainer>
      {/* useSearchParams exige fronteira de Suspense: os filtros vivem na URL (spec 004 FR-102). */}
      <Suspense fallback={<CardListSkeleton />}>
        <JobsList viewer={viewer} />
      </Suspense>
    </PageContainer>
  );
}
