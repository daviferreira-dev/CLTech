import { cn } from "@/lib/cn";
import { focusRing } from "./Button";
import { Icon } from "./Icon";

export type ChipTone = "default" | "found" | "missing" | "active";

const TONE: Record<ChipTone, string> = {
  default: "border-line bg-page text-fg",
  found: "border-success/40 bg-success-soft text-fg",
  missing: "border-dashed border-fg-subtle bg-surface text-fg-muted",
  active: "border-success/40 bg-success-soft text-fg",
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
      {tone === "found" && <Icon name="check" className="h-3 w-3" />}
      <span className="min-w-0 break-words">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? "Remover"}
          className={cn("-mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-fg-muted hover:text-fg", focusRing)}
        >
          <Icon name="close" className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

export function ChipList({ items, tone, label }: { items: string[]; tone?: ChipTone; label?: string }) {
  if (items.length === 0) return <p className="text-body text-fg-muted">—</p>;
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
