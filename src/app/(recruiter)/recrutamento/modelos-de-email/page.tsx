import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { listEmailTemplates, listTemplateUsage } from "@/server/email/library";
import { PageContainer } from "@/components/layout/AppShell";
import { EmailTemplateLibrary } from "./EmailTemplateLibrary";

export const metadata = { title: "Modelos de e-mail" };

export default async function ModelosDeEmailPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requirePageRole(RECRUITER_ROLES, currentPath("/recrutamento/modelos-de-email", await searchParams));
  const [templates, usage] = await Promise.all([listEmailTemplates(), listTemplateUsage()]);

  return (
    <PageContainer className="max-w-5xl">
      <EmailTemplateLibrary
        initial={templates.map(({ id, name, subject, body, defaultFor }) => ({ id, name, subject, body, defaultFor }))}
        usage={usage}
      />
    </PageContainer>
  );
}
