"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STAGE_TYPES, STAGE_LABEL } from "@/lib/processStages";

interface JobFields {
  title: string;
  description: string;
  company: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  seniority: "INTERN" | "JUNIOR" | "MID" | "SENIOR";
  technologies: string[];
  minimumRequirements: string;
}

interface StageItem {
  type: (typeof STAGE_TYPES)[number];
}

interface JobBuilderView extends JobFields {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  stages: StageItem[];
}

const EMPTY_FIELDS: JobFields = {
  title: "",
  description: "",
  company: "",
  location: "",
  workMode: "REMOTE",
  seniority: "JUNIOR",
  technologies: [],
  minimumRequirements: "",
};

/** Criação (sem jobId) e edição (com jobId) da vaga + pipeline — RF04. */
export function JobBuilder({ jobId }: { jobId?: string }) {
  const router = useRouter();
  const [fields, setFields] = useState<JobFields>(EMPTY_FIELDS);
  const [technologiesText, setTechnologiesText] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "CLOSED">("DRAFT");
  const [stages, setStages] = useState<StageItem[]>([]);
  const [newStageType, setNewStageType] = useState<(typeof STAGE_TYPES)[number]>("RESUME_ANALYSIS");
  const [loading, setLoading] = useState(!!jobId);
  const [saving, setSaving] = useState(false);
  const [savingStages, setSavingStages] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  useEffect(() => {
    if (!jobId) return;
    fetch(`/api/recruiter/jobs/${jobId}`)
      .then((res) => res.json())
      .then((job: JobBuilderView) => {
        setFields(job);
        setTechnologiesText(job.technologies.join(", "));
        setStatus(job.status);
        setStages(job.stages);
        setLoading(false);
      });
  }, [jobId]);

  const locked = status === "PUBLISHED";

  function updateField<K extends keyof JobFields>(key: K, value: JobFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setMissingFields([]);

    const technologies = technologiesText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = { ...fields, technologies };

    if (!jobId) {
      const res = await fetch("/api/recruiter/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaving(false);
      if (res.ok) {
        const created = await res.json();
        router.push(`/recrutamento/vagas/${created.id}`);
        return;
      }
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? "Não foi possível criar a vaga.");
      return;
    }

    const res = await fetch(`/api/recruiter/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("Alterações salvas.");
    } else {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? "Não foi possível salvar.");
    }
  }

  // `PUT /stages` substitui o pipeline inteiro: dois envios sobrepostos (cliques rápidos em
  // "Adicionar etapa") se atropelam no banco e uma etapa some sem aviso. Serializa com um
  // flag e reconcilia o estado com a resposta do servidor em vez de confiar no otimista.
  async function handleSaveStages(nextStages: StageItem[]) {
    if (!jobId || savingStages) return;
    setSavingStages(true);
    const previousStages = stages;
    setStages(nextStages);

    const res = await fetch(`/api/recruiter/jobs/${jobId}/stages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stages: nextStages }),
    });
    setSavingStages(false);

    if (res.ok) {
      const job: JobBuilderView = await res.json();
      setStages(job.stages);
      return;
    }
    setStages(previousStages);
    const body = await res.json().catch(() => null);
    setMessage(body?.error?.message ?? "Não foi possível salvar as etapas.");
  }

  function addStage() {
    handleSaveStages([...stages, { type: newStageType }]);
  }

  function removeStage(index: number) {
    handleSaveStages(stages.filter((_, i) => i !== index));
  }

  function moveStage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[index], next[target]] = [next[target] as StageItem, next[index] as StageItem];
    handleSaveStages(next);
  }

  async function handlePublish() {
    if (!jobId) return;
    setSaving(true);
    setMessage(null);
    setMissingFields([]);

    const res = await fetch(`/api/recruiter/jobs/${jobId}/publish`, { method: "POST" });
    setSaving(false);

    if (res.ok) {
      setStatus("PUBLISHED");
      setMessage("Vaga publicada.");
      return;
    }
    const body = await res.json().catch(() => null);
    setMissingFields(body?.error?.missing ?? []);
    setMessage(body?.error?.message ?? "Não foi possível publicar.");
  }

  if (loading) return <p>Carregando…</p>;

  return (
    <div className="space-y-8">
      {locked && (
        <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">
            Vaga publicada: tecnologias, requisitos mínimos e etapas do pipeline ficam travados para
            preservar o processo que os candidatos já veem.
          </p>
          <Link href={`/recrutamento/vagas/${jobId}/candidaturas`} className="shrink-0 text-sm underline">
            Ver candidatos
          </Link>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium">
            Título
          </label>
          <input
            id="title"
            value={fields.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium">
            Descrição
          </label>
          <textarea
            id="description"
            value={fields.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="company" className="block text-sm font-medium">
              Empresa
            </label>
            <input
              id="company"
              value={fields.company}
              onChange={(e) => updateField("company", e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="location" className="block text-sm font-medium">
              Localização
            </label>
            <input
              id="location"
              value={fields.location}
              onChange={(e) => updateField("location", e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="workMode" className="block text-sm font-medium">
              Modalidade
            </label>
            <select
              id="workMode"
              value={fields.workMode}
              onChange={(e) => updateField("workMode", e.target.value as JobFields["workMode"])}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            >
              <option value="REMOTE">Remoto</option>
              <option value="HYBRID">Híbrido</option>
              <option value="ONSITE">Presencial</option>
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="seniority" className="block text-sm font-medium">
              Senioridade
            </label>
            <select
              id="seniority"
              value={fields.seniority}
              onChange={(e) => updateField("seniority", e.target.value as JobFields["seniority"])}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            >
              <option value="INTERN">Estágio</option>
              <option value="JUNIOR">Júnior</option>
              <option value="MID">Pleno</option>
              <option value="SENIOR">Sênior</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="technologies" className="block text-sm font-medium">
            Tecnologias exigidas (separadas por vírgula)
          </label>
          <input
            id="technologies"
            disabled={locked}
            value={technologiesText}
            onChange={(e) => setTechnologiesText(e.target.value)}
            placeholder="React, Node, PostgreSQL"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500"
          />
          {missingFields.includes("technologies") && (
            <p className="mt-1 text-sm text-red-600">Informe ao menos uma tecnologia.</p>
          )}
        </div>
        <div>
          <label htmlFor="minimumRequirements" className="block text-sm font-medium">
            Requisitos mínimos
          </label>
          <textarea
            id="minimumRequirements"
            disabled={locked}
            value={fields.minimumRequirements}
            onChange={(e) => updateField("minimumRequirements", e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500"
          />
          {missingFields.includes("minimumRequirements") && (
            <p className="mt-1 text-sm text-red-600">Informe os requisitos mínimos.</p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Salvando…" : jobId ? "Salvar alterações" : "Salvar rascunho"}
        </button>
      </div>

      {jobId && (
        <section className="space-y-3 border-t border-slate-200 pt-6">
          <h2 className="text-lg font-semibold">Pipeline de seleção</h2>

          <ol className="space-y-2">
            {stages.map((stage, index) => (
              <li
                key={`${stage.type}-${index}`}
                className="flex items-center justify-between gap-3 rounded border border-slate-200 px-4 py-3"
              >
                <span className="min-w-0 break-words text-sm">{STAGE_LABEL[stage.type]}</span>
                {!locked && (
                  <div className="flex shrink-0 gap-2 text-sm">
                    <button
                      onClick={() => moveStage(index, -1)}
                      disabled={index === 0 || savingStages}
                      className="disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveStage(index, 1)}
                      disabled={index === stages.length - 1 || savingStages}
                      className="disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeStage(index)}
                      disabled={savingStages}
                      className="text-red-600 disabled:opacity-30"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {missingFields.includes("stages") && (
            <p className="text-sm text-red-600">Adicione ao menos uma etapa antes de publicar.</p>
          )}

          {!locked && (
            <div className="flex flex-wrap gap-3">
              <select
                aria-label="Tipo de etapa"
                value={newStageType}
                onChange={(e) => setNewStageType(e.target.value as (typeof STAGE_TYPES)[number])}
                className="w-full max-w-full rounded border border-slate-300 px-3 py-2 sm:w-auto"
              >
                {STAGE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {STAGE_LABEL[type]}
                  </option>
                ))}
              </select>
              <button
                onClick={addStage}
                disabled={savingStages}
                className="shrink-0 rounded border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
              >
                Adicionar etapa
              </button>
            </div>
          )}
        </section>
      )}

      {message && <p className="text-sm text-slate-700">{message}</p>}

      {jobId && !locked && (
        <button onClick={handlePublish} disabled={saving} className="rounded border border-slate-300 px-4 py-2 disabled:opacity-50">
          Publicar Vaga
        </button>
      )}
    </div>
  );
}
