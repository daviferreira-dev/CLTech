import { auth } from "@/server/auth/config";
import { PageContainer } from "@/components/layout/AppShell";
import { JobsList } from "./JobsList";

export const metadata = { title: "Vagas" };

export default async function JobsPage() {
  const session = await auth();
  // Só o próprio candidato vê match (FR-035); para ele, ausência de percentual é "calculando".
  const viewer = session?.user?.role === "CANDIDATE" ? "candidate" : session?.user ? "staff" : "visitor";

  return (
    <PageContainer>
      {/* Sem Suspense: a página já é dinâmica (auth), e a fronteira deixava no DOM uma cópia
          oculta da lista (H1 e ids duplicados, rótulos da busca soltos). */}
      <JobsList viewer={viewer} />
    </PageContainer>
  );
}
