import { cn } from "@/lib/cn";
import { focusRing } from "./Button";

export type ChipTone = "default" | "found" | "missing" | "active";

const TONE: Record<ChipTone, string> = {
  default: "border-brand-100 bg-canvas text-ink-900",
  found: "border-accent-600/40 bg-accent-100 text-ink-900",
  missing: "border-dashed border-ink-400 bg-surface text-ink-600",
  active: "border-accent-600/40 bg-accent-100 text-ink-900",
};

/** Chip de tecnologia (`mono-tag`): opcionalmente removível. */
export function Chip({
  tone = "default",
  onRemove,
  removeLabel,
  className,
  children,
}: {
  tone?: ChipTone;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-label",
        TONE[tone],
        className,
      )}
    >
      {tone === "found" && <span aria-hidden="true">✓</span>}
      <span className="min-w-0 break-words">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? "Remover"}
          className={cn("-mr-1 rounded-full px-1 text-ink-600 hover:text-ink-900", focusRing)}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function ChipList({ items, tone, label }: { items: string[]; tone?: ChipTone; label?: string }) {
  if (items.length === 0) return <p className="text-body text-ink-600">—</p>;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={label}>
      {items.map((item) => (
        <li key={item}>
          <Chip tone={tone}>{item}</Chip>
        </li>
      ))}
    </ul>
  );
}
