"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

/**
 * Confirmação de ação destrutiva ou irreversível (spec 003 FR-008). Usa o <dialog> nativo
 * em modo modal: o navegador já prende o foco, torna o resto da página inerte e fecha com
 * Esc — sem reimplementar nada disso à mão. *Quando* exigir confirmação é da spec 004 (FR-105).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Esc dispara `cancel`; o estado do pai é a fonte da verdade, então só avisa.
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onCancel();
      }}
      className="w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-raised p-0 text-fg shadow-popover"
    >
      <div className="space-y-2 p-6">
        <h2 id={titleId} className="text-h2">
          {title}
        </h2>
        {description && (
          <div id={descriptionId} className="text-body text-fg-muted">
            {description}
          </div>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={loading} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
