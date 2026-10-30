import Link from "next/link";
import { cn } from "@/lib/cn";
import { textLinkClasses } from "./Button";

export type BadgeVariant = "match" | "success" | "warning" | "neutral" | "danger" | "muted";

// Texto sempre em ink-900 sobre fundo claro: accent-600 e warning-500 não atingem 4.5:1 em
// 12px sobre branco, então a cor do sinal vai no fundo/borda/ponto, não no texto (AA).
const VARIANT: Record<BadgeVariant, string> = {
  match: "border-success/50 bg-success-soft text-success-ink",
  success: "border-success/50 bg-success-soft text-success-ink",
  warning: "border-warning/50 bg-warning/10 text-fg",
  neutral: "border-line bg-page text-fg",
  danger: "border-danger/40 bg-danger/10 text-fg",
  muted: "border-line bg-surface text-fg-muted",
};

const DOT: Partial<Record<BadgeVariant, string>> = {
  match: "bg-success",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
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
      return <Badge variant={matchVariant(match.value)}>{match.value}% de compatibilidade</Badge>;
    case "NEEDS_RESUME":
      return (
        <p className="text-body text-fg-muted">
          <Link href={profileHref} className={textLinkClasses}>
            Complete seu perfil para ver sua compatibilidade.
          </Link>
        </p>
      );
    case "NOT_CALCULATED":
    case "NOT_AVAILABLE_YET":
      return (
        <Badge variant="muted">
          <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-subtle motion-reduce:animate-none" />
          Calculando compatibilidade…
        </Badge>
      );
    case "FAILED":
      // FR-109: sem percentual e sem mensagem técnica.
      return null;
  }
}
