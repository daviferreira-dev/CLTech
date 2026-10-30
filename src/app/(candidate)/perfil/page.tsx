import { prisma } from "@/lib/prisma";
import { requirePageRole, CANDIDATE_ROLES, currentPath, safeInternalPath, type PageSearchParams } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileForm } from "./ProfileForm";
import { PrivacyCard } from "./PrivacyCard";

export const metadata = { title: "Meu perfil" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const params = await searchParams;
  const user = await requirePageRole(CANDIDATE_ROLES, currentPath("/perfil", params));

  // `parseStatus` existe no modelo mas não sai em GET /api/me/profile, e esta sprint não muda
  // contrato de API (spec 003 FR-006). Lido aqui no servidor; o formulário chama
  // router.refresh() após o upload para receber o valor do novo currículo.
  const currentResume = await prisma.resume.findFirst({
    where: { candidate: { userId: user.id }, isCurrent: true },
    select: { id: true, parseStatus: true },
  });

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Meu perfil" subtitle="Mantenha seus dados e currículo atualizados — é deles que sai a sua compatibilidade com as vagas." />
      <ProfileForm
        next={safeInternalPath(params.next)}
        resumeParse={currentResume ? { resumeId: currentResume.id, parseStatus: currentResume.parseStatus } : null}
        returningFrom={params.conectar === "GITHUB" || params.conectar === "LINKEDIN" ? params.conectar : null}
        linkedInEnabled={Boolean(process.env.LINKEDIN_ID && process.env.LINKEDIN_SECRET)}
      />
      <div className="mt-6">
        <PrivacyCard />
      </div>
    </PageContainer>
  );
}
