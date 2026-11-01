"use client";

// Spec 008: e-mail de um momento do processo seletivo (etapa, ou "reprovado"/"aprovado" da
// vaga) — padrão da biblioteca, outro modelo da biblioteca, texto próprio ou desligado.
// Usado por JobBuilder.tsx para cada etapa e para os dois momentos da vaga.
import { useEffect, useState } from "react";
import { EMAIL_BODY_MAX, EMAIL_SUBJECT_MAX, fillTemplate } from "@/lib/emailTemplate";
import { EMAIL_MOMENT_VARIABLES, sampleEmailValues, type EmailMoment } from "@/lib/emailMoments";
import { Badge, Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";

export interface EmailTemplateOption {
  id: string;
  name: string;
  subject: string;
  body: string;
  defaultFor: string | null;
}

export type EmailMode = "DEFAULT" | "TEMPLATE" | "CUSTOM" | "OFF";

export interface EmailMomentValue {
  emailMode: EmailMode;
  emailTemplateId: string | null;
  emailSubject: string | null;
  emailBody: string | null;
}

const MODE_LABEL: Record<EmailMode, string> = {
  DEFAULT: "Modelo padrão",
  TEMPLATE: "Modelo da biblioteca",
  CUSTOM: "Texto próprio",
  OFF: "Desligado (não envia)",
};

export function EmailMomentEditor({
  id,
  moment,
  stageLabel,
  jobTitle,
  company,
  templates,
  value,
  saving,
  onSave,
}: {
  id: string;
  moment: EmailMoment;
  /** Nome da etapa (ou "Reprovado"/"Aprovado") — só para a pré-visualização. */
  stageLabel: string;
  jobTitle: string;
  company: string;
  templates: EmailTemplateOption[] | null;
  value: EmailMomentValue;
  saving: boolean;
  onSave: (value: EmailMomentValue) => void;
}) {
  const [mode, setMode] = useState<EmailMode>(value.emailMode);
  const [templateId, setTemplateId] = useState(value.emailTemplateId ?? "");
  const [subject, setSubject] = useState(value.emailSubject ?? "");
  const [body, setBody] = useState(value.emailBody ?? "");

  useEffect(() => {
    setMode(value.emailMode);
    setTemplateId(value.emailTemplateId ?? "");
    setSubject(value.emailSubject ?? "");
    setBody(value.emailBody ?? "");
  }, [value.emailMode, value.emailTemplateId, value.emailSubject, value.emailBody]);

  const defaultTemplate = templates?.find((t) => t.defaultFor === moment) ?? null;
  const chosenTemplate = templates?.find((t) => t.id === templateId) ?? null;
  const values = sampleEmailValues(stageLabel, jobTitle, company);

  const preview =
    mode === "CUSTOM"
      ? { subject, body }
      : mode === "TEMPLATE"
        ? chosenTemplate
        : mode === "DEFAULT"
          ? defaultTemplate
          : null;

  const changed = mode !== value.emailMode || templateId !== (value.emailTemplateId ?? "") || subject !== (value.emailSubject ?? "") || body !== (value.emailBody ?? "");
  const canSave = mode !== "TEMPLATE" || Boolean(templateId);

  return (
    <div className="mt-3 space-y-3 rounded-card border border-line bg-page p-3">
      <p className="text-label text-fg-muted">E-mail ao candidato — {stageLabel}</p>
      <Field id={`${id}-modo`} label="Como enviar">
        <Select value={mode} onChange={(e) => setMode(e.target.value as EmailMode)}>
          {Object.entries(MODE_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      {mode === "TEMPLATE" && (
        <Field id={`${id}-modelo`} label="Modelo da biblioteca">
          {templates === null ? (
            <p className="text-body text-fg-muted">Carregando modelos…</p>
          ) : (
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Escolha um modelo</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      {mode === "CUSTOM" && (
        <>
          <Field id={`${id}-assunto`} label="Assunto">
            <Input maxLength={EMAIL_SUBJECT_MAX} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto do e-mail" />
          </Field>
          <Field
            id={`${id}-corpo`}
            label="Mensagem"
            hint={`Variáveis: ${EMAIL_MOMENT_VARIABLES[moment].map((v) => `{{${v}}}`).join(", ")}.`}
          >
            <Textarea rows={5} maxLength={EMAIL_BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </>
      )}

      {mode === "OFF" && <Notice tone="warning">Nenhum e-mail será enviado neste momento.</Notice>}

      {mode !== "OFF" && preview && (preview.subject.trim() || preview.body.trim()) && (
        <div className="rounded-card border border-line bg-surface p-3" aria-label="Pré-visualização do e-mail">
          <p className="flex items-center justify-between gap-2 text-label text-fg-muted">
            Pré-visualização (dados de exemplo)
            {mode === "DEFAULT" && <Badge variant="muted">Modelo padrão</Badge>}
          </p>
          <p className="mt-1 break-words text-body font-medium text-fg">{fillTemplate(preview.subject, values)}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-body text-fg">{fillTemplate(preview.body, values)}</p>
        </div>
      )}
      {mode === "TEMPLATE" && templates !== null && !chosenTemplate && templateId === "" && (
        <p className="text-body text-fg-muted">Escolha um modelo para ver a pré-visualização.</p>
      )}

      <Button
        size="sm"
        variant="secondary"
        loading={saving}
        disabled={!changed || !canSave}
        onClick={() =>
          onSave({
            emailMode: mode,
            emailTemplateId: mode === "TEMPLATE" ? templateId || null : null,
            emailSubject: mode === "CUSTOM" ? subject : null,
            emailBody: mode === "CUSTOM" ? body : null,
          })
        }
      >
        Salvar e-mail
      </Button>
    </div>
  );
}
