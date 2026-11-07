"use client";

// Spec 008 — biblioteca de modelos de e-mail do RH. Um padrão por momento (não pode ser
// excluído, só editado) e quantos modelos livres o RH quiser (editar/duplicar/excluir).
import { useState } from "react";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { EMAIL_BODY_MAX, EMAIL_NAME_MAX, EMAIL_SUBJECT_MAX, fillTemplate } from "@/lib/emailTemplate";
import { EMAIL_MOMENTS, EMAIL_MOMENT_LABEL, EMAIL_MOMENT_VARIABLES, sampleEmailValues, type EmailMoment } from "@/lib/emailMoments";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { EmailTemplateOption } from "@/components/recruiter/EmailMomentEditor";
import { Badge, Breadcrumb, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Notice, Textarea } from "@/components/ui";

// Variáveis de um modelo livre: não está preso a um momento, então mostra as mais comuns.
const GENERIC_VARIABLES = ["candidato", "vaga", "empresa", "etapa", "link"] as const;
// Só valem quando o modelo é usado na etapa de teste de código.
const CODE_TEST_VARIABLES = ["prazo", "link_teste"] as const;

export function EmailTemplateLibrary({
  initial,
  usage,
}: {
  initial: EmailTemplateOption[];
  /** Títulos das vagas que usam cada modelo livre, por id. */
  usage: Record<string, string[]>;
}) {
  const [items, setItems] = useState(initial);
  const [creating, setCreating] = useState(false);

  const defaults = EMAIL_MOMENTS.map((moment) => items.find((t) => t.defaultFor === moment)).filter(
    (t): t is EmailTemplateOption => Boolean(t),
  );
  const customs = items.filter((t) => !t.defaultFor);

  function handleCreated(template: EmailTemplateOption) {
    setItems((prev) => [...prev, template]);
    setCreating(false);
  }
  function handleUpdated(template: EmailTemplateOption) {
    setItems((prev) => prev.map((t) => (t.id === template.id ? template : t)));
  }
  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <>
      <PageHeader
        breadcrumb={<Breadcrumb items={[{ label: "Painel", href: "/recrutamento" }, { label: "Modelos de e-mail" }]} />}
        title="Modelos de e-mail"
        subtitle="Textos enviados automaticamente ao candidato em cada momento do processo seletivo. Edite os padrões ou crie os seus — depois escolha qual usar na montagem de cada vaga."
        actions={!creating ? <Button onClick={() => setCreating(true)}>Novo modelo</Button> : undefined}
      />

      {creating && <EmailTemplateForm onCancel={() => setCreating(false)} onSaved={handleCreated} />}

      <section className="space-y-3">
        <h2 className="text-h3 text-fg">Padrões por momento</h2>
        <p className="text-body text-fg-muted">Um para cada momento do processo. Dá para editar o texto, mas não excluir.</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {defaults.map((template) => (
            <EmailTemplateCard
              key={template.id}
              template={template}
              moment={template.defaultFor as EmailMoment}
              onCreated={handleCreated}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-h3 text-fg">Modelos criados por você</h2>
        {customs.length === 0 ? (
          <EmptyState
            title="Nenhum modelo próprio ainda."
            description="Crie um para usar em qualquer etapa ou vaga, além dos padrões."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {customs.map((template) => (
              <EmailTemplateCard
                key={template.id}
                template={template}
                moment={null}
                usedBy={usage[template.id] ?? []}
                onCreated={handleCreated}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function EmailTemplateCard({
  template,
  moment,
  usedBy = [],
  onCreated,
  onUpdated,
  onDeleted,
}: {
  template: EmailTemplateOption;
  moment: EmailMoment | null;
  usedBy?: string[];
  onCreated: (t: EmailTemplateOption) => void;
  onUpdated: (t: EmailTemplateOption) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    // Dentro do <ul> da listagem: o filho direto precisa continuar sendo um <li>.
    return (
      <li>
        <EmailTemplateForm
          template={template}
          moment={moment}
          onCancel={() => setEditing(false)}
          onSaved={(t) => {
            onUpdated(t);
            setEditing(false);
          }}
        />
      </li>
    );
  }

  async function handleDuplicate() {
    setDuplicating(true);
    const result = await apiFetch<EmailTemplateOption>(
      "/api/recruiter/email-templates",
      jsonInit("POST", { name: `${template.name} (cópia)`, subject: template.subject, body: template.body }),
    );
    setDuplicating(false);
    if (result.ok) onCreated(result.data);
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await apiFetch<void>(`/api/recruiter/email-templates/${template.id}`, { method: "DELETE" });
    setDeleting(false);
    setConfirmDelete(false);
    if (result.ok) {
      onDeleted(template.id);
      return;
    }
    if (result.status === 401) return;
    setError(result.networkError ? NETWORK_ERROR_MESSAGE : (result.error?.message ?? "Não foi possível excluir o modelo."));
  }

  return (
    <Card as="li" className="space-y-2 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="break-words text-h3 text-fg">{template.name}</h3>
        {moment && <Badge variant="muted">{EMAIL_MOMENT_LABEL[moment]}</Badge>}
      </div>
      <p className="break-words text-body font-medium text-fg">{template.subject}</p>
      <p className="whitespace-pre-wrap break-words text-body text-fg-muted">{template.body}</p>
      {usedBy.length > 0 && (
        <p className="break-words text-label text-fg-muted">Em uso em: {usedBy.join(", ")}</p>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button size="sm" variant="secondary" loading={duplicating} onClick={handleDuplicate}>
          Duplicar
        </Button>
        {!moment && (
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
            Excluir
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir este modelo?"
        description={
          usedBy.length > 0
            ? `Usado em: ${usedBy.join(", ")}. Essas vagas voltam a usar o modelo padrão do momento. Isso não pode ser desfeito.`
            : "Nenhuma vaga usa este modelo. Isso não pode ser desfeito."
        }
        confirmLabel="Excluir"
        tone="danger"
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </Card>
  );
}

function EmailTemplateForm({
  template,
  moment,
  onCancel,
  onSaved,
}: {
  template?: EmailTemplateOption;
  moment?: EmailMoment | null;
  onCancel: () => void;
  onSaved: (t: EmailTemplateOption) => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variables = moment ? EMAIL_MOMENT_VARIABLES[moment] : GENERIC_VARIABLES;
  const toTags = (list: readonly string[]) => list.map((v) => `{{${v}}}`).join(", ");
  const variablesHint = moment
    ? `Variáveis: ${toTags(variables)}.`
    : `Variáveis: ${toTags(variables)}. Na etapa de teste de código também: ${toTags(CODE_TEST_VARIABLES)}.`;
  const values = sampleEmailValues(moment ? EMAIL_MOMENT_LABEL[moment] : "Entrevista Técnica", "Desenvolvedor(a) Backend", "3aq");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const payload = { name, subject, body };
    const result = template
      ? await apiFetch<EmailTemplateOption>(`/api/recruiter/email-templates/${template.id}`, jsonInit("PATCH", payload))
      : await apiFetch<EmailTemplateOption>("/api/recruiter/email-templates", jsonInit("POST", payload));
    setSaving(false);
    if (result.ok) {
      onSaved(result.data);
      return;
    }
    if (result.status === 401) return;
    setError(result.networkError ? NETWORK_ERROR_MESSAGE : (result.error?.message ?? "Não foi possível salvar o modelo."));
  }

  return (
    <Card as="section" aria-labelledby="form-modelo-email" className="mb-6">
      <CardHeader
        titleId="form-modelo-email"
        title={template ? "Editar modelo" : "Novo modelo"}
        description={moment ? `Modelo padrão de: ${EMAIL_MOMENT_LABEL[moment]}.` : "Disponível para qualquer etapa ou vaga."}
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field id="modelo-nome" label="Nome">
            <Input value={name} maxLength={EMAIL_NAME_MAX} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field id="modelo-assunto" label="Assunto">
            <Input value={subject} maxLength={EMAIL_SUBJECT_MAX} onChange={(e) => setSubject(e.target.value)} required />
          </Field>
          <Field id="modelo-corpo" label="Mensagem" hint={variablesHint}>
            <Textarea rows={6} maxLength={EMAIL_BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} required />
          </Field>
          {(subject.trim() || body.trim()) && (
            <div className="rounded-card border border-line bg-page p-3" aria-label="Pré-visualização do e-mail">
              <p className="text-label text-fg-muted">Pré-visualização (dados de exemplo)</p>
              {subject.trim() && <p className="mt-1 break-words text-body font-medium text-fg">{fillTemplate(subject, values)}</p>}
              {body.trim() && <p className="mt-1 whitespace-pre-wrap break-words text-body text-fg">{fillTemplate(body, values)}</p>}
            </div>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={saving}>
              {template ? "Salvar alterações" : "Criar modelo"}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
