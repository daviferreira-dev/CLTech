import { cn } from "@/lib/cn";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Avatar por iniciais — não há foto de perfil no modelo. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClass = { sm: "h-8 w-8 text-label", md: "h-10 w-10 text-body", lg: "h-16 w-16 text-h2" }[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-900 font-semibold text-surface",
        sizeClass,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
