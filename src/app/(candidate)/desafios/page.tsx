import { requirePageRole, CANDIDATE_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { listMyChallenges } from "@/server/code-test/session";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { RefreshOnFocus } from "@/components/layout/RefreshOnFocus";
import { ButtonLink, EmptyState } from "@/components/ui";
import { ChallengeList } from "./ChallengeList";

export const metadata = { title: "Desafios" };

export default async function DesafiosPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const user = await requirePageRole(CANDIDATE_ROLES, currentPath("/desafios", await searchParams));
  const items = await listMyChallenges(user.id);

  return (
    <PageContainer className="max-w-4xl">
      <RefreshOnFocus />
      <PageHeader
        title="Desafios"
        subtitle="Quando uma candidatura chega à etapa de teste de código, o desafio aparece aqui."
      />
      {items.length === 0 ? (
        <EmptyState
          title="Nenhum desafio pendente."
          description="Nenhuma das suas candidaturas está na etapa de teste de código agora."
          action={
            <ButtonLink href="/candidaturas" variant="secondary">
              Ver minhas candidaturas
            </ButtonLink>
          }
        />
      ) : (
        <ChallengeList items={items} />
      )}
    </PageContainer>
  );
}
