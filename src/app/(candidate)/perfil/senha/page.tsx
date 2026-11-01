import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole, CANDIDATE_ROLES } from "@/lib/guards";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { ButtonLink, Card, CardBody, Notice, textLinkClasses } from "@/components/ui";

export const metadata = { title: "Trocar senha" };

// Só de candidato, como o resto de /perfil e api/me (lgpd-access.test.ts).
export default async function ChangePasswordPage() {
  const user = await requirePageRole(CANDIDATE_ROLES, "/perfil/senha");
  const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });

  return (
    <PageContainer className="max-w-xl">
      <PageHeader title="Trocar senha" subtitle="Ao salvar, as sessões abertas em outros aparelhos são encerradas. Esta continua aberta." />
      <Card>
        <CardBody>
          {passwordHash ? (
            <NewPasswordForm
              mode="change"
              success={
                <Notice tone="success" title="Senha alterada" action={<ButtonLink href="/perfil" variant="secondary">Voltar</ButtonLink>}>
                  Mandamos um aviso para o seu e-mail.
                </Notice>
              }
            />
          ) : (
            // Conta criada pelo GitHub/LinkedIn: não há senha atual para confirmar.
            <Notice title="Sua conta ainda não tem senha">
              Você entra pelo GitHub ou LinkedIn. Para criar uma senha, use{" "}
              <Link href="/esqueci-senha" className={textLinkClasses}>
                Esqueci minha senha
              </Link>{" "}
              com o e-mail {user.email}.
            </Notice>
          )}
        </CardBody>
      </Card>
    </PageContainer>
  );
}
