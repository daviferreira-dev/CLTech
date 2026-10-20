import { Children, cloneElement, forwardRef, isValidElement } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "./Button";

const controlBase = cn(
  "w-full min-w-0 rounded-field border border-brand-100 bg-surface px-3 text-body text-ink-900",
  "placeholder:text-ink-400 transition-colors hover:border-ink-400",
  "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-600 disabled:opacity-70",
  "aria-[invalid=true]:border-danger-600",
  focusRing,
  "focus-visible:ring-offset-0",
);

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(controlBase, "h-10", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(controlBase, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
});

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
      <label htmlFor={id} className="block text-label text-ink-600">
        {label}
      </label>
      {enhanced}
      {hint && (
        <p id={hintId} className="text-label font-normal text-ink-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-label text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
