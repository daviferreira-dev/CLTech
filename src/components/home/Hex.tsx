import { cn } from "@/lib/cn";

// Posto hexagonal do funil — o mesmo desenho do símbolo da marca, usado como "estação de inspeção".
export function Hex({ state = "todo", className }: { state?: "done" | "current" | "todo"; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-hex={state}
      className={cn(
        "relative grid h-9 w-9 shrink-0 place-items-center [clip-path:polygon(25%_3%,75%_3%,100%_50%,75%_97%,25%_97%,0_50%)]",
        state === "done" && "bg-success text-inverse",
        state === "current" && "bg-action text-on-color",
        state === "todo" && "bg-line text-fg-subtle",
        className,
      )}
    >
      {state === "done" ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5 6.5 11.5 12.5 5" />
        </svg>
      ) : (
        <span className="h-2 w-2 rounded-full bg-current" />
      )}
    </span>
  );
}
