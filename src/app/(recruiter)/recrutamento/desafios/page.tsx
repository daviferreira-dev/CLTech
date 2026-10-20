import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { listChallenges } from "@/server/code-test/challenges";
import { PageContainer } from "@/components/layout/AppShell";
import { ChallengeCatalog } from "./ChallengeCatalog";

export default async function DesafiosCatalogoPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const user = await requirePageRole(RECRUITER_ROLES, currentPath("/recrutamento/desafios", await searchParams));
  const challenges = await listChallenges();

  return (
    <PageContainer className="max-w-5xl">
      <ChallengeCatalog initial={challenges} canCreate={user.role === "ADMIN"} />
    </PageContainer>
  );
}
