import { cn } from "@/lib/cn";

/** Coluna lateral de refino ao lado de uma lista (spec 003 US2). Em mobile vira um bloco acima. */
export function SidebarFilters({
  title = "Filtros",
  footer,
  className,
  children,
}: {
  title?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <aside aria-label={title} className={cn("rounded-card border border-brand-100 bg-surface p-4 sm:p-6", className)}>
      <h2 className="mb-4 font-display text-h2 text-brand-900">{title}</h2>
      <div className="space-y-4">{children}</div>
      {footer && <div className="mt-4 border-t border-brand-100 pt-4">{footer}</div>}
    </aside>
  );
}

/** Layout lista + coluna lateral. */
export function WithSidebar({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="min-w-0">{sidebar}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
