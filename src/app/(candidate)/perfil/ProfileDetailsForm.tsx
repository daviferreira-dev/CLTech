"use client";

// Formulário do perfil (FR-009 + spec 007): dados básicos e perfil profissional, salvos
// juntos num único PATCH. Controlado, porque o rascunho do currículo entra por fora:
// `draft` muda a cada upload (nonce) e é mesclado só nos campos vazios (decisão P2) —
// nada é gravado até o candidato clicar Salvar.

import { useEffect, useRef, useState } from "react";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import type { ProfileDetails } from "@/lib/profile-details";
import { PROFILE_LIMITS as L } from "@/lib/profile-details";
import { fromProfile, mergeDraft, toPayload, type DraftField, type ProfileDraft, type ProfileFormState } from "@/lib/profile-form";
import { Button, Card, CardBody, CardHeader, Field, Input, Notice, TagInput, Textarea } from "@/components/ui";
import { EducationEditor, ExperienceEditor, FromResumeBadge, LanguageEditor, LinkEditor } from "./ProfileListEditors";

export interface EditableProfile {
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  details: ProfileDetails;
}

const SAVED_MESSAGE_MS = 4000;

const FIELD_LABEL: Record<DraftField, string> = {
  phone: "telefone",
  city: "cidade",
  state: "estado",
  headline: "título",
  summary: "resumo",
  technologies: "tecnologias",
  softSkills: "habilidades",
  experiences: "experiências",
  educations: "formação",
  languages: "idiomas",
  links: "links",
};

export function ProfileDetailsForm<P extends EditableProfile>({
  profile,
  draft,
  onSaved,
}: {
  profile: P;
  /** Rascunho do último upload; `nonce` muda a cada envio para reaplicar. */
  draft: { nonce: number; value: ProfileDraft } | null;
  onSaved: (profile: P) => void;
}) {
  // Inicializado uma vez: recarregar o perfil (ex.: depois do upload) não apaga o que o
  // candidato está digitando.
  const [form, setForm] = useState<ProfileFormState>(() => fromProfile(profile));
  const [filled, setFilled] = useState<DraftField[]>([]);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  useEffect(() => {
    if (!draft) return;
    const merged = mergeDraft(form, draft.value);
    setForm(merged.form);
    setFilled(merged.filled);
    setDraftNotice(
      merged.filled.length > 0
        ? `Preenchemos ${merged.filled.length} ${merged.filled.length === 1 ? "campo" : "campos"} com base no currículo (${merged.filled
            .map((f) => FIELD_LABEL[f])
            .join(", ")}). Revise e clique em Salvar.`
        : "Lemos seu currículo, mas os campos que encontramos já estavam preenchidos.",
    );
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Só reage a um upload novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.nonce]);

  const set = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const isFilled = (field: DraftField) => filled.includes(field);
  const label = (text: string, field: DraftField) => (
    <span className="inline-flex flex-wrap items-center gap-2">
      {text} <FromResumeBadge show={isFilled(field)} />
    </span>
  );

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveResult(null);
    const result = await apiFetch<P>("/api/me/profile", jsonInit("PATCH", toPayload(form)));
    setSaving(false);

    if (result.ok) {
      onSaved(result.data);
      setForm(fromProfile(result.data));
      setFilled([]);
      setDraftNotice(null);
      setSaveResult({ tone: "success", text: "Alterações salvas." });
      // US3.7: a confirmação some sozinha; o espaço é reservado, então nada se desloca.
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveResult(null), SAVED_MESSAGE_MS);
    } else if (result.networkError) {
      setSaveResult({ tone: "danger", text: NETWORK_ERROR_MESSAGE });
    } else if (result.status !== 401) {
      setSaveResult({ tone: "danger", text: result.error?.message ?? "Não foi possível salvar as alterações." });
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSave} className="scroll-mt-24 space-y-6">
      {draftNotice && (
        <Notice tone={filled.length > 0 ? "info" : "success"} title="Currículo lido">
          {draftNotice}
        </Notice>
      )}

      <Card as="section" aria-labelledby="dados-basicos">
        <CardHeader titleId="dados-basicos" title="Dados Básicos" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Nome Completo" className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
            </Field>
            <Field id="email" label="E-mail" hint="O e-mail identifica sua conta e não pode ser alterado aqui.">
              <Input value={profile.email} readOnly disabled />
            </Field>
            <Field id="phone" label={label("Telefone", "phone")}>
              <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
            </Field>
            <Field id="city" label={label("Cidade", "city")}>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
            </Field>
            <Field id="state" label={label("Estado (UF)", "state")}>
              <Input
                value={form.state}
                maxLength={2}
                className="uppercase"
                onChange={(e) => set("state", e.target.value)}
                autoComplete="address-level1"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card as="section" aria-labelledby="resumo-profissional">
        <CardHeader titleId="resumo-profissional" title="Resumo Profissional" description="Como você se apresenta para os recrutadores." />
        <CardBody className="space-y-4">
          <Field id="headline" label={label("Título", "headline")} hint="Ex.: Desenvolvedora Backend Pleno">
            <Input value={form.headline} maxLength={L.headline} onChange={(e) => set("headline", e.target.value)} />
          </Field>
          <Field id="summary" label={label("Sobre você", "summary")} hint={`${form.summary.length}/${L.summary} caracteres`}>
            <Textarea rows={5} value={form.summary} maxLength={L.summary} onChange={(e) => set("summary", e.target.value)} />
          </Field>
        </CardBody>
      </Card>

      <Card as="section" aria-labelledby="experiencias">
        <CardHeader
          titleId="experiencias"
          title={label("Experiências", "experiences")}
          description="Adicione quantas quiser, da mais recente para a mais antiga."
        />
        <CardBody>
          <ExperienceEditor items={form.experiences} onChange={(items) => set("experiences", items)} />
        </CardBody>
      </Card>

      <Card as="section" aria-labelledby="formacao">
        <CardHeader titleId="formacao" title={label("Formação", "educations")} />
        <CardBody>
          <EducationEditor items={form.educations} onChange={(items) => set("educations", items)} />
        </CardBody>
      </Card>

      <Card as="section" aria-labelledby="tecnologias">
        <CardHeader
          titleId="tecnologias"
          title="Tecnologias e Habilidades"
          description="As tecnologias entram no cálculo do seu match com as vagas."
        />
        <CardBody className="space-y-4">
          <Field id="technologies" label={label("Tecnologias", "technologies")} hint="Digite e tecle Enter ou vírgula. Ex.: React, Java, Docker">
            <TagInput
              values={form.technologies}
              onChange={(values) => set("technologies", values)}
              maxItems={L.tagCount}
              maxLength={L.tagLength}
            />
          </Field>
          <Field id="softSkills" label={label("Habilidades", "softSkills")} hint="Ex.: Comunicação, Liderança, Trabalho em equipe">
            <TagInput
              values={form.softSkills}
              onChange={(values) => set("softSkills", values)}
              maxItems={L.tagCount}
              maxLength={L.tagLength}
            />
          </Field>
        </CardBody>
      </Card>

      <Card as="section" aria-labelledby="idiomas">
        <CardHeader titleId="idiomas" title={label("Idiomas", "languages")} />
        <CardBody>
          <LanguageEditor items={form.languages} onChange={(items) => set("languages", items)} />
        </CardBody>
      </Card>

      <Card as="section" aria-labelledby="perfis">
        <CardHeader
          titleId="perfis"
          title={label("Perfis Profissionais", "links")}
          description="Portfólio, site pessoal, Behance… GitHub, LinkedIn e Lattes também podem ser conectados abaixo, em “Conecte suas contas”."
        />
        <CardBody>
          <LinkEditor items={form.links} onChange={(items) => set("links", items)} />
        </CardBody>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-3 border-t border-brand-100 bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-card sm:border">
        {/* Altura reservada: a mensagem entra e sai sem deslocar o layout (US3.7). */}
        <div className="min-h-5" aria-live="polite">
          {saveResult && (
            <p
              role={saveResult.tone === "danger" ? "alert" : undefined}
              className={saveResult.tone === "danger" ? "text-body text-danger-600" : "text-body text-ink-900"}
            >
              {saveResult.tone === "success" && <span aria-hidden="true" className="mr-1 text-accent-600">✓</span>}
              {saveResult.text}
            </p>
          )}
        </div>
        <Button type="submit" loading={saving}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
