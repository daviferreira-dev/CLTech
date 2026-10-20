import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/AppShell";
import { CardListSkeleton } from "@/components/ui";
import { Dashboard } from "./Dashboard";

export default async function RecrutamentoPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requirePageRole(RECRUITER_ROLES, currentPath("/recrutamento", await searchParams));

  return (
    <PageContainer>
      <Suspense fallback={<CardListSkeleton label="Carregando painel…" />}>
        <Dashboard />
      </Suspense>
    </PageContainer>
  );
}
