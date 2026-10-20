import { cn } from "@/lib/cn";

// Superfície elevada por borda sutil, não por sombra (spec 003, "Forma e espaçamento").
export function Card({
  as: Tag = "div",
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "li" | "article" }) {
  return (
    <Tag className={cn("rounded-card border border-brand-100 bg-surface", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  titleId,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleId?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6", className)}>
      <div className="min-w-0">
        <h2 id={titleId} className="break-words text-h2 text-ink-900">
          {title}
        </h2>
        {description && <p className="mt-1 text-body text-ink-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-4 sm:p-6", className)}>{children}</div>;
}
