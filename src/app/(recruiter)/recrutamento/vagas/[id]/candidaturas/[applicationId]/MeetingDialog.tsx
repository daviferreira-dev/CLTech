"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, Input } from "@/components/ui";

/** Pede data e link da reunião ao mover o candidato para uma entrevista (RH/técnica). */
export function MeetingDialog({
  open,
  title,
  description,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  loading: boolean;
  onConfirm: (meeting: { scheduledAt: string; url: string }) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [when, setWhen] = useState("");
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) setSubmitted(false);
  }, [open]);

  const date = when ? new Date(when) : null;
  const whenError = !date || Number.isNaN(date.getTime()) ? "Informe a data e a hora." : date.getTime() <= Date.now() ? "A data deve ser no futuro." : null;
  const urlError = /^https?:\/\/\S+$/i.test(url.trim()) ? null : "Informe um link começando com http:// ou https://.";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (whenError || urlError || !date) return;
    onConfirm({ scheduledAt: date.toISOString(), url: url.trim() });
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
          <Field id="reuniao-data" label="Data e hora da reunião" error={submitted ? whenError : undefined}>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field id="reuniao-link" label="Link da reunião" hint="Meet, Zoom, Teams…" error={submitted ? urlError : undefined}>
            <Input type="url" inputMode="url" placeholder="https://meet.google.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Avançar e agendar
          </Button>
        </div>
      </form>
    </dialog>
  );
}
