import Link from "next/link";
import { cn } from "@/lib/cn";
import { textLinkClasses } from "./Button";

export type BadgeVariant = "match" | "success" | "warning" | "neutral" | "danger" | "muted";

// Texto sempre em ink-900 sobre fundo claro: accent-600 e warning-500 não atingem 4.5:1 em
// 12px sobre branco, então a cor do sinal vai no fundo/borda/ponto, não no texto (AA).
const VARIANT: Record<BadgeVariant, string> = {
  match: "border-accent-600/50 bg-accent-100 text-accent-900",
  success: "border-accent-600/50 bg-accent-100 text-accent-900",
  warning: "border-warning-500/50 bg-warning-500/10 text-ink-900",
  neutral: "border-brand-100 bg-canvas text-ink-900",
  danger: "border-danger-600/40 bg-danger-600/10 text-ink-900",
  muted: "border-brand-100 bg-surface text-ink-600",
};

const DOT: Partial<Record<BadgeVariant, string>> = {
  match: "bg-accent-600",
  success: "bg-accent-600",
  warning: "bg-warning-500",
  danger: "bg-danger-600",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  const dot = DOT[variant];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-label font-semibold",
        VARIANT[variant],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

/** Os cinco estados de match que a API pode devolver (spec 003 FR-009, spec 004 FR-109). */
export type MatchState =
  | { status: "CALCULATED"; value: number }
  | { status: "NEEDS_RESUME" }
  | { status: "NOT_CALCULATED" }
  | { status: "NOT_AVAILABLE_YET" }
  | { status: "FAILED" };

/** FR-010: mesma escala em todas as telas — ≥ 80 accent, 50–79 neutral, < 50 apagado. */
export function matchVariant(value: number): BadgeVariant {
  if (value >= 80) return "match";
  if (value >= 50) return "neutral";
  return "muted";
}

export function MatchBadge({ match, profileHref = "/perfil" }: { match: MatchState; profileHref?: string }) {
  switch (match.status) {
    case "CALCULATED":
      return <Badge variant={matchVariant(match.value)}>{match.value}% match</Badge>;
    case "NEEDS_RESUME":
      return (
        <p className="text-body text-ink-600">
          <Link href={profileHref} className={textLinkClasses}>
            Complete seu perfil para ver seu match.
          </Link>
        </p>
      );
    case "NOT_CALCULATED":
    case "NOT_AVAILABLE_YET":
      return (
        <Badge variant="muted">
          <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-400 motion-reduce:animate-none" />
          Calculando match…
        </Badge>
      );
    case "FAILED":
      // FR-109: sem percentual e sem mensagem técnica.
      return null;
  }
}
