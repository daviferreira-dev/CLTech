import Link from "next/link";
import { cn } from "@/lib/cn";
import { buttonClasses, focusRing } from "./Button";

export interface Crumb {
  label: string;
  href?: string;
}

/** Caminho de volta (spec 003 FR-008). O último item é a página atual. */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Caminho de navegação" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body text-ink-600">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className={cn("rounded-sm break-words hover:text-ink-900 hover:underline", focusRing)}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className="break-words font-medium text-ink-900">
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-ink-400">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Paginação por links: a página vive na query string (spec 004 FR-102), então cada
 * botão é um href e o voltar do navegador funciona sem estado local.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const visible = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-body text-ink-600">
        Página {page} de {totalPages}
      </p>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Anterior
            </span>
          )}
        </li>
        {visible.map((p, i) => (
          <li key={p} className="flex items-center gap-1">
            {i > 0 && p - (visible[i - 1] as number) > 1 && (
              <span aria-hidden="true" className="px-1 text-ink-400">
                …
              </span>
            )}
            <Link
              href={hrefFor(p)}
              aria-current={p === page ? "page" : undefined}
              aria-label={`Página ${p}`}
              className={buttonClasses({ variant: p === page ? "primary" : "ghost", size: "sm", className: "min-w-8" })}
            >
              {p}
            </Link>
          </li>
        ))}
        <li>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Próxima
            </Link>
          ) : (
            <span aria-disabled="true" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Próxima
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}

export interface StageTrailItem {
  type: string;
  label: string;
}

/**
 * Pipeline como trilha ordenada (spec 003 US4.1/US4.4). Com `currentIndex`, marca as
 * etapas concluídas, a atual e as futuras — "a etapa sozinha não diz quanto falta".
 */
export function StageTrail({
  stages,
  currentIndex,
  finished = false,
  label = "Etapas do processo",
}: {
  stages: StageTrailItem[];
  currentIndex?: number;
  /** Processo encerrado: nenhuma etapa fica marcada como "atual". */
  finished?: boolean;
  label?: string;
}) {
  return (
    <ol aria-label={label} className="flex flex-wrap gap-x-1 gap-y-2">
      {stages.map((stage, index) => {
        const state =
          currentIndex === undefined
            ? "neutral"
            : index < currentIndex
              ? "done"
              : index === currentIndex
                ? finished
                  ? "done"
                  : "current"
                : "todo";
        return (
          <li key={`${stage.type}-${index}`} className="flex items-center gap-1" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-label",
                state === "done" && "border-accent-600/50 bg-accent-100 text-accent-900",
                state === "current" && "border-primary-600 bg-primary-600 text-surface",
                state === "todo" && "border-brand-100 bg-surface text-ink-600",
                state === "neutral" && "border-brand-100 bg-canvas text-ink-900",
              )}
            >
              <span aria-hidden="true" className="tabular-nums">
                {state === "done" ? "✓" : index + 1}
              </span>
              {stage.label}
              {state === "current" && <span className="sr-only">(etapa atual)</span>}
            </span>
            {index < stages.length - 1 && (
              <span aria-hidden="true" className="text-ink-400">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
