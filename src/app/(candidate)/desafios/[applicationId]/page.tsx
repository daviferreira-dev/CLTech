import { redirect } from "next/navigation";
import { ApiError } from "@/lib/errors";
import { requirePageRole, CANDIDATE_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { openChallenge } from "@/server/code-test/session";
import { PageContainer } from "@/components/layout/AppShell";
import { ButtonLink, EmptyState } from "@/components/ui";
import { ChallengeWorkspace } from "./ChallengeWorkspace";

export const metadata = { title: "Teste de código" };

export default async function DesafioPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { applicationId } = await params;
  const user = await requirePageRole(CANDIDATE_ROLES, currentPath(`/desafios/${applicationId}`, await searchParams));

  let view;
  try {
    view = await openChallenge(user.id, applicationId);
  } catch (err) {
    // FR-203 / US2.2: o acesso deriva da etapa atual; link adivinhado volta para as candidaturas.
    if (err instanceof ApiError && (err.code === "NOT_AVAILABLE_YET" || err.code === "NOT_FOUND")) {
      redirect("/candidaturas?desafio=indisponivel");
    }
    if (err instanceof ApiError && err.code === "CODE_TEST_NOT_CONFIGURED") {
      return (
        <PageContainer className="max-w-2xl">
          <EmptyState
            title="Desafio ainda não disponível"
            description={err.message}
            action={
              <ButtonLink href="/desafios" variant="secondary">
                Voltar aos desafios
              </ButtonLink>
            }
          />
        </PageContainer>
      );
    }
    throw err;
  }

  return (
    <PageContainer>
      <ChallengeWorkspace initial={view} />
    </PageContainer>
  );
}
