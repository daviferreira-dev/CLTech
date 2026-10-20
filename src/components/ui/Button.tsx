import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

// Anel de foco de 2px em brand-900 com offset 2px em todo elemento interativo (spec 003,
// "Estados obrigatórios"). Exportado para links e controles que não são <Button>.
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-900 focus-visible:ring-offset-2";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-900 text-surface hover:bg-brand-700",
  secondary: "border border-brand-100 bg-surface text-ink-900 hover:bg-canvas",
  ghost: "text-ink-900 hover:bg-brand-100/60",
  danger: "bg-danger-600 text-surface hover:bg-danger-600/90",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-body",
  md: "h-10 px-4 text-body",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-field font-medium",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    focusRing,
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
    />
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Requisição em voo: desabilita e mostra indicador (FR-005, FR-104). */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading = false, disabled, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}

/** Link de texto no padrão do produto (sublinhado, cor de marca, foco visível). */
export const textLinkClasses = cn(
  "rounded-sm font-medium text-brand-900 underline underline-offset-2 hover:text-brand-700",
  focusRing,
);
