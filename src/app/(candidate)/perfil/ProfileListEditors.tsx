"use client";

// Editores das listas do perfil profissional (spec 007): cada linha tem "Remover" e a
// lista tem "+ Adicionar". Sem limite mínimo — zero itens é válido (US1.2).

import {
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABEL,
  LANGUAGE_LEVELS,
  LANGUAGE_LEVEL_LABEL,
  PROFILE_LIMITS as L,
} from "@/lib/profile-details";
import {
  emptyEducation,
  emptyExperience,
  emptyLanguage,
  emptyLink,
  type EducationForm,
  type ExperienceForm,
  type LanguageForm,
  type LinkForm,
} from "@/lib/profile-form";
import { Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";

/** Selo dos campos pré-preenchidos pelo currículo (decisão P2). */
export function FromResumeBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return <Badge variant="match">do currículo</Badge>;
}

function replaceAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function ListShell<T>({
  items,
  onChange,
  create,
  addLabel,
  emptyText,
  itemLabel,
  children,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  addLabel: string;
  emptyText: string;
  itemLabel: (index: number) => string;
  children: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {items.length === 0 && <p className="text-body text-ink-600">{emptyText}</p>}
      {items.map((item, index) => (
        <fieldset key={index} className="space-y-4 rounded-card border border-brand-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <legend className="text-body font-medium text-ink-900">{itemLabel(index)}</legend>
            <Button variant="ghost" size="sm" onClick={() => onChange(items.filter((_, i) => i !== index))}>
              Remover
            </Button>
          </div>
          {children(item, index)}
        </fieldset>
      ))}
      {items.length < L.listItems && (
        <Button variant="secondary" size="sm" onClick={() => onChange([...items, create()])}>
          + {addLabel}
        </Button>
      )}
    </div>
  );
}

export function ExperienceEditor({ items, onChange }: { items: ExperienceForm[]; onChange: (items: ExperienceForm[]) => void }) {
  return (
    <ListShell
      items={items}
      onChange={onChange}
      create={emptyExperience}
      addLabel="Adicionar experiência"
      emptyText="Nenhuma experiência adicionada."
      itemLabel={(i) => `Experiência ${i + 1}`}
    >
      {(item, i) => {
        const set = (patch: Partial<ExperienceForm>) => onChange(replaceAt(items, i, patch));
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`exp-${i}-role`} label="Cargo">
              <Input value={item.role} maxLength={L.role} onChange={(e) => set({ role: e.target.value })} />
            </Field>
            <Field id={`exp-${i}-company`} label="Empresa">
              <Input value={item.company} maxLength={L.company} onChange={(e) => set({ company: e.target.value })} />
            </Field>
            <Field id={`exp-${i}-start`} label="Início">
              <Input type="month" value={item.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            </Field>
            {!item.isCurrent && (
              <Field id={`exp-${i}-end`} label="Fim">
                <Input type="month" value={item.endDate} min={item.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} />
              </Field>
            )}
            <label className="flex items-center gap-2 text-body text-ink-900 sm:col-span-2">
              <input
                type="checkbox"
                checked={item.isCurrent}
                onChange={(e) => set({ isCurrent: e.target.checked, endDate: e.target.checked ? "" : item.endDate })}
                className="h-4 w-4 accent-brand-900"
              />
              Trabalho aqui atualmente
            </label>
            <Field id={`exp-${i}-description`} label="Descrição (opcional)" className="sm:col-span-2">
              <Textarea rows={3} value={item.description} maxLength={L.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </div>
        );
      }}
    </ListShell>
  );
}

export function EducationEditor({ items, onChange }: { items: EducationForm[]; onChange: (items: EducationForm[]) => void }) {
  return (
    <ListShell
      items={items}
      onChange={onChange}
      create={emptyEducation}
      addLabel="Adicionar formação"
      emptyText="Nenhuma formação adicionada."
      itemLabel={(i) => `Formação ${i + 1}`}
    >
      {(item, i) => {
        const set = (patch: Partial<EducationForm>) => onChange(replaceAt(items, i, patch));
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`edu-${i}-course`} label="Curso">
              <Input value={item.course} maxLength={L.course} onChange={(e) => set({ course: e.target.value })} />
            </Field>
            <Field id={`edu-${i}-institution`} label="Instituição">
              <Input value={item.institution} maxLength={L.institution} onChange={(e) => set({ institution: e.target.value })} />
            </Field>
            <Field id={`edu-${i}-level`} label="Nível">
              <Select value={item.level} onChange={(e) => set({ level: e.target.value as EducationForm["level"] })}>
                <option value="">Selecione…</option>
                {EDUCATION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {EDUCATION_LEVEL_LABEL[level]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id={`edu-${i}-start`} label="Início">
                <Input type="month" value={item.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              </Field>
              <Field id={`edu-${i}-end`} label={item.inProgress ? "Previsão" : "Conclusão"}>
                <Input type="month" value={item.endDate} onChange={(e) => set({ endDate: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-body text-ink-900 sm:col-span-2">
              <input
                type="checkbox"
                checked={item.inProgress}
                onChange={(e) => set({ inProgress: e.target.checked })}
                className="h-4 w-4 accent-brand-900"
              />
              Em andamento
            </label>
          </div>
        );
      }}
    </ListShell>
  );
}

export function LanguageEditor({ items, onChange }: { items: LanguageForm[]; onChange: (items: LanguageForm[]) => void }) {
  return (
    <ListShell
      items={items}
      onChange={onChange}
      create={emptyLanguage}
      addLabel="Adicionar idioma"
      emptyText="Nenhum idioma adicionado."
      itemLabel={(i) => `Idioma ${i + 1}`}
    >
      {(item, i) => {
        const set = (patch: Partial<LanguageForm>) => onChange(replaceAt(items, i, patch));
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`lang-${i}-name`} label="Idioma">
              <Input value={item.name} maxLength={L.languageName} placeholder="Ex.: Inglês" onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field id={`lang-${i}-level`} label="Nível">
              <Select value={item.level} onChange={(e) => set({ level: e.target.value as LanguageForm["level"] })}>
                <option value="">Selecione…</option>
                {LANGUAGE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {LANGUAGE_LEVEL_LABEL[level]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        );
      }}
    </ListShell>
  );
}

export function LinkEditor({ items, onChange }: { items: LinkForm[]; onChange: (items: LinkForm[]) => void }) {
  return (
    <ListShell
      items={items}
      onChange={onChange}
      create={emptyLink}
      addLabel="Adicionar link"
      emptyText="Nenhum link adicionado."
      itemLabel={(i) => `Link ${i + 1}`}
    >
      {(item, i) => {
        const set = (patch: Partial<LinkForm>) => onChange(replaceAt(items, i, patch));
        return (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Field id={`link-${i}-label`} label="Nome">
              <Input value={item.label} maxLength={L.linkLabel} placeholder="Ex.: Portfólio" onChange={(e) => set({ label: e.target.value })} />
            </Field>
            <Field id={`link-${i}-url`} label="Endereço">
              <Input type="url" value={item.url} maxLength={L.linkUrl} placeholder="https://" onChange={(e) => set({ url: e.target.value })} />
            </Field>
          </div>
        );
      }}
    </ListShell>
  );
}
