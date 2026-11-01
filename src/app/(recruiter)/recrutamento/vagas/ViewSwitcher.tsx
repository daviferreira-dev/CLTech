"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui";

const TABS = [
  { href: "/recrutamento/vagas", label: "Lista" },
  { href: "/recrutamento/vagas/visao-geral", label: "Visão geral" },
];

/** Alterna entre a lista simples de vagas e a visão macro (mesmo "Minhas vagas", dois formatos). */
export function ViewSwitcher() {
  const pathname = usePathname();
  return (
    <div role="tablist" aria-label="Formato das vagas" className="mb-6 flex gap-1 border-b border-line">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-body font-medium transition-colors",
              active ? "border-action text-fg" : "border-transparent text-fg-muted hover:text-fg",
              focusRing,
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
