import { cn } from "@/lib/cn";
import { Button } from "./Button";

/**
 * Estados terminais de lista (spec 003 FR-004). Toda variante recebe uma ação: a spec 004
 * (SC-104) proíbe tela sem saída acionável.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-brand-100 bg-surface px-4 py-10 text-center sm:px-6",
        className,
      )}
    >
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-h2 text-ink-400">
        ∅
      </span>
      <p className="text-h3 text-ink-900">{title}</p>
      {description && <p className="max-w-md text-body text-ink-600">{description}</p>}
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar.",
  description,
  onRetry,
  action,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-danger-600/30 bg-surface px-4 py-10 text-center sm:px-6",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-600/10 text-h2 text-danger-600"
      >
        !
      </span>
      <p className="text-h3 text-ink-900">{title}</p>
      {description && <p className="max-w-md text-body text-ink-600">{description}</p>}
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Tentar de novo
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block animate-pulse rounded-field bg-brand-100 motion-reduce:animate-none", className)} />;
}

/** Placeholder de lista de cartões enquanto a resposta não chega (US2.7). */
export function CardListSkeleton({ count = 3, label = "Carregando…" }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-card border border-brand-100 bg-surface p-4 sm:p-6">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export type NoticeTone = "info" | "success" | "warning" | "danger";

const NOTICE_TONE: Record<NoticeTone, string> = {
  info: "border-brand-100 bg-canvas",
  success: "border-accent-600/40 bg-accent-100",
  warning: "border-warning-500/50 bg-warning-500/10",
  danger: "border-danger-600/40 bg-danger-600/10",
};

/** Aviso em linha. Erros usam role="alert"; o resto, role="status". */
export function Notice({
  tone = "info",
  title,
  action,
  className,
  children,
}: {
  tone?: NoticeTone;
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-card border px-4 py-3 text-body text-ink-900 sm:flex-row sm:items-center sm:justify-between",
        NOTICE_TONE[tone],
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="break-words text-ink-900">{children}</div>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}
