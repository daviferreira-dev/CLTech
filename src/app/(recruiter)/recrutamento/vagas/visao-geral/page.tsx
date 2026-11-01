import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/AppShell";
import { CardListSkeleton } from "@/components/ui";
import { VisaoGeralVagas } from "./VisaoGeralVagas";

export const metadata = { title: "Visão geral das vagas" };

export default async function VisaoGeralVagasPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requirePageRole(RECRUITER_ROLES, currentPath("/recrutamento/vagas/visao-geral", await searchParams));

  return (
    <PageContainer>
      <Suspense fallback={<CardListSkeleton label="Carregando visão geral…" />}>
        <VisaoGeralVagas />
      </Suspense>
    </PageContainer>
  );
}
