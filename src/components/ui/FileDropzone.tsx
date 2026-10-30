"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "./Button";

/**
 * Área de soltar arquivo, acionável também por teclado (Enter/Espaço abrem o seletor).
 * O <input type="file"> continua no DOM — é por ele que os testes E2E enviam o arquivo.
 */
export function FileDropzone({
  accept,
  hint,
  disabled = false,
  busy = false,
  error,
  onFile,
  label = "Arraste o arquivo ou clique para selecionar",
}: {
  accept: string;
  hint: React.ReactNode;
  disabled?: boolean;
  busy?: boolean;
  error?: string | null;
  onFile: (file: File) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const errorId = useId();

  function pick(file: File | undefined) {
    if (file && !disabled && !busy) onFile(file);
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || busy || undefined}
        aria-describedby={[hintId, error ? errorId : null].filter(Boolean).join(" ")}
        onClick={() => !disabled && !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled && !busy) inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-action bg-action-soft" : "border-line bg-surface hover:border-fg-subtle",
          error && "border-danger/60",
          (disabled || busy) && "cursor-not-allowed opacity-50",
          focusRing,
        )}
      >
        <span aria-hidden="true" className="text-h2 text-fg-subtle">
          ⇪
        </span>
        <span className="text-body font-medium text-fg">{busy ? "Enviando…" : label}</span>
        <span id={hintId} className="text-label font-normal text-fg-muted">
          {hint}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          tabIndex={-1}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            // Permite reenviar o mesmo arquivo depois de um erro.
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
