import { auth } from "@/server/auth/config";
import { destinationForRole } from "@/server/auth/redirect";
import { AppShell, PageContainer } from "@/components/layout/AppShell";
import { ButtonLink, EmptyState } from "@/components/ui";

// Spec 004 US7.3: rota inexistente ou recurso fora do alcance do usuário — sempre com um
// caminho de volta coerente com o papel (SC-104).
export default async function NotFound() {
  const session = await auth();
  const role = session?.user?.role;
  const home = role ? destinationForRole(role) : "/vagas";
  const homeLabel = role && role !== "CANDIDATE" ? "Ir para o painel" : "Ver vagas abertas";

  return (
    <AppShell>
      <PageContainer className="max-w-2xl">
        <EmptyState
          title="Página não encontrada"
          description="O endereço não existe ou você não tem acesso a este conteúdo."
          action={<ButtonLink href={home}>{homeLabel}</ButtonLink>}
        />
      </PageContainer>
    </AppShell>
  );
}
