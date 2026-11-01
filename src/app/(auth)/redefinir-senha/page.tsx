import Link from "next/link";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { ButtonLink, Notice, textLinkClasses } from "@/components/ui";

// O link traz o token na query: nenhuma requisição desta página manda a URL em Referer.
export const metadata = { title: "Criar senha nova", referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-display text-fg">Criar senha nova</h1>
        <p className="text-body text-fg-muted">Digite a senha nova duas vezes. Ao salvar, as sessões abertas em outros aparelhos são encerradas.</p>
      </div>
      <NewPasswordForm
        mode="reset"
        invalidLink={
          <>
            Este link expirou ou já foi usado.{" "}
            <Link href="/esqueci-senha" className={textLinkClasses}>
              Peça um novo
            </Link>
            .
          </>
        }
        success={
          <Notice tone="success" title="Senha alterada" action={<ButtonLink href="/entrar">Entrar</ButtonLink>}>
            Agora é só entrar com a senha nova.
          </Notice>
        }
      />
    </div>
  );
}
