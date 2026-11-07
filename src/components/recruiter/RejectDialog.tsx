"use client";

// Spec 009: reprovar exige motivo (interno, alimenta indicadores) e oferece um retorno ao
// candidato, que vai no e-mail. Usado no relatório (um candidato) e na lista (em lote).
import { useEffect, useRef, useState } from "react";
import { REJECTION_REASON_LABEL } from "@/lib/labels";
import { RECRUITER_REJECTION_REASONS, REJECTION_FEEDBACK_MAX, type RejectionInput } from "@/lib/validation/applications";
import { Button, Field, Select, Textarea } from "@/components/ui";

export function RejectDialog({
  open,
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  loading: boolean;
  onConfirm: (rejection: RejectionInput) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) {
      setSubmitted(false);
      setReason("");
      setFeedback("");
    }
  }, [open]);

  const reasonError = reason ? null : "Escolha o motivo da reprovação.";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (reasonError) return;
    onConfirm({ reason: reason as RejectionInput["reason"], feedback: feedback.trim() || undefined });
  }

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onCancel();
      }}
      className="w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-raised p-0 text-fg shadow-popover"
    >
      <form onSubmit={submit} noValidate>
        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <h2 className="text-h2">{title}</h2>
            <div className="text-body text-fg-muted">{description}</div>
          </div>
          <Field id="reprovar-motivo" label="Motivo" hint="Fica só com a equipe e entra nos indicadores." error={submitted ? reasonError : undefined}>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Escolha um motivo</option>
              {RECRUITER_REJECTION_REASONS.map((value) => (
                <option key={value} value={value}>
                  {REJECTION_REASON_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="reprovar-retorno"
            label="Retorno ao candidato (opcional)"
            hint={`Vai no e-mail de reprovação. ${feedback.length}/${REJECTION_FEEDBACK_MAX}`}
          >
            <Textarea
              rows={4}
              maxLength={REJECTION_FEEDBACK_MAX}
              value={feedback}
              placeholder="Ex.: recomendamos aprofundar testes automatizados antes do próximo processo."
              onChange={(e) => setFeedback(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
