import { Children, cloneElement, forwardRef, isValidElement } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { focusRing } from "./Button";
import { SelectMenu } from "./SelectMenu";

export const controlBase = cn(
  "w-full min-w-0 rounded-field border border-fg-subtle/40 bg-surface px-3 text-body text-fg",
  "placeholder:text-fg-subtle transition-colors hover:border-fg-subtle",
  "disabled:cursor-not-allowed disabled:bg-page disabled:text-fg-muted disabled:opacity-70",
  "aria-[invalid=true]:border-danger",
  focusRing,
  "focus-visible:ring-offset-0",
);

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(controlBase, "h-10", className)} {...props} />;
});

/** Campo de busca com lupa à esquerda; repassa id/aria para o input (funciona dentro de Field). */
export const SearchInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function SearchInput(
  { className, ...props },
  ref,
) {
  return (
    <div className="relative">
      <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
      <input ref={ref} type="search" className={cn(controlBase, "h-10 pl-10", className)} {...props} />
    </div>
  );
});

// Lista suspensa própria (SelectMenu): mesmo contrato do <select> controlado, visual da marca.
export const Select = SelectMenu;

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlBase, "py-2", className)} {...props} />;
  },
);

/**
 * Rótulo + controle + dica + erro, com `htmlFor`/`aria-describedby`/`aria-invalid`
 * ligados automaticamente (FR-005). O único filho deve ser o controle.
 */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
}) {
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = Children.only(children);
  const enhanced = isValidElement(control)
    ? cloneElement(control, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : control;

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <label htmlFor={id} className="block text-label text-fg-muted">
        {label}
      </label>
      {enhanced}
      {hint && (
        <p id={hintId} className="text-label font-normal text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-label text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
