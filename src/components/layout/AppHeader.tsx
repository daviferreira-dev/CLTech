"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/cn";
import { Avatar, ButtonLink, Icon, Logo, focusRing } from "@/components/ui";
import { ThemeToggle } from "./ThemeToggle";
import type { HeaderRole, HeaderUser, NavItem } from "./nav";

const ROLE_LABEL: Record<HeaderRole, string> = {
  CANDIDATE: "Candidato(a)",
  RECRUITER: "Recrutador(a)",
  ADMIN: "Administrador(a)",
};

function isActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  return item.matchPrefix ? pathname.startsWith(`${item.matchPrefix}/`) || pathname === item.matchPrefix : false;
}

export function AppHeader({ user, nav }: { user: HeaderUser | null; nav: NavItem[] }) {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fecha os menus ao trocar de rota.
  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Fecha o menu do usuário ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!userMenuOpen) return;
    function onPointer(e: MouseEvent) {
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  const homeHref = !user ? "/" : user.role === "CANDIDATE" ? "/vagas" : "/recrutamento";
  // Busca de vagas alimenta `q` em /vagas (spec 003). Fica fora da própria /vagas, que tem a
  // sua barra de busca, e fora do recrutamento, que não lista vagas públicas.
  const showJobSearch = (!user || user.role === "CANDIDATE") && pathname !== "/vagas";

  const navLinks = (layout: "row" | "column") =>
    nav.map((item) => {
      const active = isActive(item, pathname);
      return (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block rounded-field px-3 py-2 text-body font-medium transition-colors",
              active ? "bg-action-soft text-link" : "text-fg-muted hover:bg-page hover:text-fg",
              focusRing,
            )}
          >
            {item.label}
          </Link>
        </li>
      );
    });

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface shadow-header">
      <div className="mx-auto flex h-16 max-w-content items-center gap-4 px-4 sm:px-6">
        <Link href={homeHref} className={cn("flex shrink-0 items-center gap-2 rounded-field", focusRing)}>
          <Logo size={30} />
        </Link>

        <nav aria-label="Navegação principal" className="hidden md:block">
          <ul className="flex items-center gap-1">{navLinks("row")}</ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {showJobSearch && (
            <form action="/vagas" method="get" role="search" className="hidden lg:block">
              <label htmlFor="busca-header" className="sr-only">
                Buscar vagas por cargo ou tecnologia
              </label>
              <input
                id="busca-header"
                name="q"
                type="search"
                placeholder="Buscar vagas…"
                className={cn(
                  "h-9 w-56 rounded-full border border-line bg-page px-4 text-body text-fg placeholder:text-fg-subtle",
                  focusRing,
                  "focus-visible:ring-offset-0",
                )}
              />
            </form>
          )}

          <ThemeToggle />

          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-controls="menu-usuario"
                onClick={() => setUserMenuOpen((open) => !open)}
                className={cn("flex items-center gap-2 rounded-field p-1 hover:bg-page", focusRing)}
              >
                <Avatar name={user.name} size="sm" />
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block max-w-40 truncate text-body font-medium text-fg">{user.name}</span>
                  <span className="block text-label font-normal text-fg-muted">{ROLE_LABEL[user.role]}</span>
                </span>
                <span className="sr-only sm:hidden">Menu do usuário</span>
              </button>
              {userMenuOpen && (
                <div
                  id="menu-usuario"
                  className="absolute right-0 mt-2 w-56 rounded-card border border-line bg-raised p-2 shadow-popover"
                >
                  <div className="border-b border-line px-2 pb-2 sm:hidden">
                    <p className="truncate text-body font-medium text-fg">{user.name}</p>
                    <p className="text-label font-normal text-fg-muted">{ROLE_LABEL[user.role]}</p>
                  </div>
                  {user.role === "CANDIDATE" && (
                    <Link
                      href="/perfil"
                      className={cn("block rounded-field px-2 py-2 text-body text-fg hover:bg-page", focusRing)}
                    >
                      Meu perfil
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className={cn("block w-full rounded-field px-2 py-2 text-left text-body text-fg hover:bg-page", focusRing)}
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <ButtonLink href="/entrar" variant="ghost" size="sm">
                Entrar
              </ButtonLink>
              <ButtonLink href="/cadastro" size="sm">
                Cadastrar
              </ButtonLink>
            </div>
          )}

          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="menu-principal-mobile"
            onClick={() => setMenuOpen((open) => !open)}
            className={cn("rounded-field p-2 text-fg hover:bg-page md:hidden", focusRing)}
          >
            <span className="sr-only">{menuOpen ? "Fechar menu" : "Abrir menu"}</span>
            <Icon name={menuOpen ? "close" : "menu"} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="menu-principal-mobile" aria-label="Navegação principal (menu)" className="border-t border-line px-4 py-3 md:hidden">
          <ul className="space-y-1">{navLinks("column")}</ul>
          {!user && (
            <div className="mt-3 flex gap-2 border-t border-line pt-3 sm:hidden">
              <ButtonLink href="/entrar" variant="secondary" size="sm" className="flex-1">
                Entrar
              </ButtonLink>
              <ButtonLink href="/cadastro" size="sm" className="flex-1">
                Cadastrar
              </ButtonLink>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
