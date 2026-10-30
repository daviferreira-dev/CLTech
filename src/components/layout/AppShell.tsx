import { auth } from "@/server/auth/config";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui";
import { AppHeader } from "./AppHeader";
import { navFor, type HeaderUser, type NavItem } from "./nav";

/**
 * Casca comum de toda tela (spec 003 US1, FR-003): link de pular conteúdo, cabeçalho com a
 * navegação do papel da sessão e a região principal. A sessão é lida no servidor para que o
 * cabeçalho já chegue certo, sem piscar de "visitante" para "logado".
 */
export async function AppShell({ children, candidateExtraNav = [] }: { children: React.ReactNode; candidateExtraNav?: NavItem[] }) {
  const session = await auth();
  const user: HeaderUser | null = session?.user?.role
    ? { name: session.user.name ?? session.user.email ?? "Usuário", role: session.user.role }
    : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className={cn(
          "sr-only z-50 rounded-field bg-inverse px-4 py-2 text-body font-medium text-on-color focus:not-sr-only focus:fixed focus:left-4 focus:top-4",
          focusRing,
        )}
      >
        Pular para o conteúdo
      </a>
      <AppHeader user={user} nav={navFor(user, candidateExtraNav)} />
      <main id="conteudo" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-2 px-4 py-4 text-label text-fg-muted sm:px-6">
          <span>CLTech · 3aq Tecnologia</span>
          {/* Spec 006, FR-307 — aviso de privacidade acessível de qualquer tela (LGPD art. 9º). */}
          <a href="/privacidade" className={cn("inline-flex min-h-6 items-center underline-offset-2 hover:underline", focusRing)}>
            Aviso de privacidade
          </a>
        </div>
      </footer>
    </div>
  );
}

/** Contêiner de largura máxima (1280px) com respiro lateral de 16/24px. */
export function PageContainer({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-content px-4 py-8 sm:px-6 sm:py-10", className)}>{children}</div>;
}
