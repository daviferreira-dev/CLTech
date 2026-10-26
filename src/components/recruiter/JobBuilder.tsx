"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_TYPES, STAGE_LABEL, MIN_POSITIONS, MAX_POSITIONS, positionsOf } from "@/lib/processStages";
import {
  DEFAULT_TIME_LIMIT_MINUTES,
  DIFFICULTY_LABEL,
  LANGUAGE_LABEL,
  MAX_TEST_RUNS,
  MAX_TIME_LIMIT_MINUTES,
  MIN_TIME_LIMIT_MINUTES,
  isCodeTestConfigComplete,
  type CodeTestStageConfig,
} from "@/lib/codeTest";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE, type ApiResult } from "@/lib/api-client";
import { JOB_STATUS_BADGE, JOB_STATUS_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  Input,
  Notice,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";

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

type StageType = (typeof STAGE_TYPES)[number];

interface StageItem {
  type: StageType;
  config?: Record<string, unknown>;
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

// INCOMPLETE_JOB devolve `missing` com estes nomes (src/server/jobs/builder.ts).
const MISSING_LABEL: Record<string, string> = {
  technologies: "ao menos uma tecnologia",
  minimumRequirements: "os requisitos mínimos",
  stages: "ao menos uma etapa no pipeline",
  codeTest: "o desafio, as linguagens e o tempo da etapa de teste de código",
};

interface ChallengeOption {
  id: string;
  title: string;
  difficulty: string;
  languages: string[];
  visibleCases: Array<{ index: number }>;
  hiddenCaseCount: number;
}

type Banner = { tone: "success" | "danger" | "warning" | "info"; title?: string; text: string } | null;

/** Criação (sem jobId) e edição (com jobId) da vaga + pipeline — RF04. */
export function JobBuilder({ jobId }: { jobId?: string }) {
  const router = useRouter();
  const [fields, setFields] = useState<JobFields>(EMPTY_FIELDS);
  const [technologiesText, setTechnologiesText] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "CLOSED">("DRAFT");
  const [stages, setStages] = useState<StageItem[]>([]);
  const [newStageType, setNewStageType] = useState<StageType>("RESUME_ANALYSIS");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed" | "notFound">(jobId ? "loading" : "ready");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingStages, setSavingStages] = useState(false);
  const [message, setMessage] = useState<Banner>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [catalog, setCatalog] = useState<ChallengeOption[] | null>(null);

  // Alterações de campo ainda não salvas (spec 004 US4.7). O pipeline é salvo a cada ação,
  // então só os campos do formulário contam.
  const [dirty, setDirty] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const applyView = useCallback((job: JobBuilderView) => {
    setFields(job);
    setTechnologiesText(job.technologies.join(", "));
    setStatus(job.status);
    setStages(job.stages);
  }, []);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoadState("loading");
    const result = await apiFetch<JobBuilderView>(`/api/recruiter/jobs/${jobId}`);
    if (result.ok) {
      applyView(result.data);
      setDirty(false);
      setLoadState("ready");
    } else {
      setLoadState(result.status === 404 ? "notFound" : "failed");
    }
  }, [jobId, applyView]);

  useEffect(() => {
    load();
  }, [load]);

  // Saída com alterações não salvas: aviso nativo ao fechar/recarregar a aba e confirmação
  // própria ao clicar em qualquer link interno (US4.7, FR-105 "descartar rascunho").
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    function onClickCapture(e: MouseEvent) {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search + url.hash);
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  // Catálogo de desafios só é buscado quando o pipeline tem teste de código (spec 005 US1).
  const hasFinalOffer = stages.some((stage) => stage.type === "FINAL_OFFER");
  const hasCodeTest = stages.some((stage) => stage.type === "CODE_TEST");
  useEffect(() => {
    if (!hasCodeTest || catalog !== null) return;
    apiFetch<{ items: ChallengeOption[] }>("/api/recruiter/challenges").then((result) => {
      setCatalog(result.ok && Array.isArray(result.data?.items) ? result.data.items : []);
    });
  }, [hasCodeTest, catalog]);

  const locked = status === "PUBLISHED";

  function updateField<K extends keyof JobFields>(key: K, value: JobFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  /** Traduz os códigos de vaga em próximo passo (spec 004 US4.3–US4.5, FR-103). */
  async function handleFailure(result: Extract<ApiResult<unknown>, { ok: false }>, fallback: string) {
    if (result.status === 401) return;
    if (result.networkError) {
      setMessage({ tone: "danger", text: NETWORK_ERROR_MESSAGE });
      return;
    }
    const code = result.error?.code;
    if (code === "JOB_LOCKED") {
      await load();
      setMessage({
        tone: "warning",
        title: "Pipeline travado",
        text: "Esta vaga já foi publicada: tecnologias, requisitos mínimos e etapas não mudam mais. Título, descrição, empresa, localização, modalidade e senioridade continuam editáveis.",
      });
      return;
    }
    if (code === "ALREADY_PUBLISHED") {
      await load();
      setMessage({ tone: "info", text: "Esta vaga já estava publicada. A tela foi atualizada com o estado atual." });
      return;
    }
    setMessage({ tone: "danger", text: result.error?.message ?? fallback });
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);
    setMissingFields([]);

    const technologies = technologiesText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = { ...fields, technologies };

    if (!jobId) {
      const result = await apiFetch<JobBuilderView>("/api/recruiter/jobs", jsonInit("POST", payload));
      setSaving(false);
      if (result.ok) {
        setDirty(false);
        dirtyRef.current = false;
        router.push(`/recrutamento/vagas/${result.data.id}`);
        return;
      }
      await handleFailure(result, "Não foi possível criar a vaga.");
      return;
    }

    // Vaga publicada: os campos travados não vão no PATCH (o servidor recusaria com JOB_LOCKED).
    const patch = locked ? { ...payload, technologies: undefined, minimumRequirements: undefined } : payload;
    const result = await apiFetch<JobBuilderView>(`/api/recruiter/jobs/${jobId}`, jsonInit("PATCH", patch));
    setSaving(false);
    if (result.ok) {
      setDirty(false);
      setMessage({ tone: "success", text: "Alterações salvas." });
    } else {
      await handleFailure(result, "Não foi possível salvar.");
    }
  }

  // `PUT /stages` substitui o pipeline inteiro: dois envios sobrepostos (cliques rápidos em
  // "Adicionar etapa") se atropelam no banco e uma etapa some sem aviso. Serializa com um
  // flag e reconcilia o estado com a resposta do servidor em vez de confiar no otimista.
  async function handleSaveStages(nextStages: StageItem[]) {
    if (!jobId || savingStages) return;
    setSavingStages(true);
    setMessage(null);
    const previousStages = stages;
    setStages(nextStages);

    const result = await apiFetch<{ stages: StageItem[] }>(`/api/recruiter/jobs/${jobId}/stages`, jsonInit("PUT", { stages: nextStages }));
    setSavingStages(false);

    if (result.ok) {
      setStages(result.data.stages);
      setMissingFields((prev) => prev.filter((f) => f !== "stages"));
      return;
    }
    setStages(previousStages);
    await handleFailure(result, "Não foi possível salvar as etapas.");
  }

  function addStage() {
    if (newStageType === "FINAL_OFFER" && hasFinalOffer) return;
    handleSaveStages([...stages, { type: newStageType }]);
  }

  function updateStageConfig(index: number, config: CodeTestStageConfig | { positions: number }) {
    handleSaveStages(stages.map((stage, i) => (i === index ? { ...stage, config: config as Record<string, unknown> } : stage)));
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
    if (!jobId || publishing) return;
    setPublishing(true);
    setMessage(null);
    setMissingFields([]);

    // A rota de publicação devolve só { id, status, publishedAt }: o resto do estado fica.
    const result = await apiFetch<{ status: JobBuilderView["status"] }>(`/api/recruiter/jobs/${jobId}/publish`, { method: "POST" });
    setPublishing(false);
    setConfirmPublish(false);

    if (result.ok) {
      setStatus(result.data.status ?? "PUBLISHED");
      setMessage({ tone: "success", text: "Vaga publicada." });
      return;
    }
    if (result.error?.code === "INCOMPLETE_JOB") {
      // US4.3: aponta exatamente o que falta e mantém o rascunho intacto.
      const missing = Array.isArray(result.error.missing) ? (result.error.missing as string[]) : [];
      setMissingFields(missing);
      const parts = missing.map((m) => MISSING_LABEL[m] ?? m);
      setMessage({
        tone: "danger",
        title: "Faltam dados para publicar",
        text: parts.length > 0 ? `Informe ${parts.join(", ")}. O rascunho foi mantido.` : (result.error.message ?? "Preencha os dados mínimos."),
      });
      return;
    }
    await handleFailure(result, "Não foi possível publicar.");
  }

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "Painel", href: "/recrutamento" },
        { label: "Minhas Vagas", href: "/recrutamento/vagas" },
        { label: jobId ? fields.title || "Vaga" : "Nova vaga" },
      ]}
    />
  );

  if (loadState === "loading") {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <span className="sr-only">Carregando vaga…</span>
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }
  if (loadState === "notFound") {
    return (
      <ErrorState
        title="Vaga não encontrada."
        action={
          <ButtonLink href="/recrutamento/vagas" variant="secondary">
            Voltar às vagas
          </ButtonLink>
        }
      />
    );
  }
  if (loadState === "failed") {
    return <ErrorState title="Não foi possível carregar a vaga." onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={breadcrumb}
        title={jobId ? "Editar Vaga" : "Criar Vaga"}
        subtitle={jobId ? <Badge variant={JOB_STATUS_BADGE[status]}>{JOB_STATUS_LABEL[status]}</Badge> : "Salve o rascunho para montar o pipeline de seleção."}
        actions={
          locked ? (
            <ButtonLink href={`/recrutamento/vagas/${jobId}/candidaturas`} variant="secondary">
              Ver candidatos
            </ButtonLink>
          ) : undefined
        }
      />

      {locked && (
        <Notice tone="info">
          Vaga publicada: tecnologias, requisitos mínimos e etapas do pipeline ficam travados para preservar o processo
          que os candidatos já veem.
        </Notice>
      )}

      {message && (
        <Notice tone={message.tone} title={message.title}>
          {message.text}
        </Notice>
      )}

      <Card as="section" aria-labelledby="dados-vaga">
        <CardHeader titleId="dados-vaga" title="Dados da vaga" />
        <CardBody>
          <form onSubmit={handleSave} className="space-y-4">
            <Field id="title" label="Título">
              <Input value={fields.title} onChange={(e) => updateField("title", e.target.value)} />
            </Field>
            <Field id="description" label="Descrição">
              <Textarea value={fields.description} onChange={(e) => updateField("description", e.target.value)} rows={4} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="company" label="Empresa">
                <Input value={fields.company} onChange={(e) => updateField("company", e.target.value)} />
              </Field>
              <Field id="location" label="Localização">
                <Input value={fields.location} onChange={(e) => updateField("location", e.target.value)} />
              </Field>
              <Field id="workMode" label="Modalidade">
                <Select value={fields.workMode} onChange={(e) => updateField("workMode", e.target.value as JobFields["workMode"])}>
                  <option value="REMOTE">Remoto</option>
                  <option value="HYBRID">Híbrido</option>
                  <option value="ONSITE">Presencial</option>
                </Select>
              </Field>
              <Field id="seniority" label="Senioridade">
                <Select value={fields.seniority} onChange={(e) => updateField("seniority", e.target.value as JobFields["seniority"])}>
                  <option value="INTERN">Estágio</option>
                  <option value="JUNIOR">Júnior</option>
                  <option value="MID">Pleno</option>
                  <option value="SENIOR">Sênior</option>
                </Select>
              </Field>
            </div>
            <Field
              id="technologies"
              label="Tecnologias exigidas (separadas por vírgula)"
              hint={locked ? "Travado após a publicação." : undefined}
              error={missingFields.includes("technologies") ? "Informe ao menos uma tecnologia." : undefined}
            >
              <Input
                disabled={locked}
                value={technologiesText}
                onChange={(e) => {
                  setTechnologiesText(e.target.value);
                  setDirty(true);
                }}
                placeholder="React, Node, PostgreSQL"
              />
            </Field>
            <Field
              id="minimumRequirements"
              label="Requisitos mínimos"
              hint={locked ? "Travado após a publicação." : undefined}
              error={missingFields.includes("minimumRequirements") ? "Informe os requisitos mínimos." : undefined}
            >
              <Textarea disabled={locked} value={fields.minimumRequirements} onChange={(e) => updateField("minimumRequirements", e.target.value)} rows={3} />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={saving}>
                {saving ? "Salvando…" : jobId ? "Salvar alterações" : "Salvar rascunho"}
              </Button>
              {dirty && <span className="text-body text-ink-600">Alterações não salvas.</span>}
            </div>
          </form>
        </CardBody>
      </Card>

      {jobId && (
        <Card as="section" aria-labelledby="pipeline">
          <CardHeader
            titleId="pipeline"
            title="Pipeline de seleção"
            description={locked ? "Ordem definida na publicação." : "A ordem exibida é a ordem que o candidato vai percorrer."}
          />
          <CardBody className="space-y-4">
            {stages.length === 0 ? (
              <p className="text-body text-ink-600">Nenhuma etapa ainda. Adicione ao menos uma para publicar.</p>
            ) : (
              <ol className="space-y-2" aria-busy={savingStages || undefined}>
                {stages.map((stage, index) => {
                  const label = STAGE_LABEL[stage.type];
                  return (
                    <li key={`${stage.type}-${index}`} className="rounded-card border border-brand-100 bg-surface px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-label text-surface"
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0 break-words text-body font-medium text-ink-900">{label}</span>
                        </span>
                        {!locked && (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveStage(index, -1)}
                              disabled={index === 0 || savingStages}
                              aria-label={`Mover ${label} para cima`}
                            >
                              ↑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveStage(index, 1)}
                              disabled={index === stages.length - 1 || savingStages}
                              aria-label={`Mover ${label} para baixo`}
                            >
                              ↓
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStage(index)}
                              disabled={savingStages}
                              className="text-danger-600"
                              aria-label={`Remover ${label}`}
                            >
                              Remover
                            </Button>
                          </div>
                        )}
                      </div>
                      {stage.type === "CODE_TEST" && (
                        <CodeTestConfigPanel
                          stageIndex={index}
                          config={(stage.config ?? {}) as CodeTestStageConfig}
                          catalog={catalog}
                          locked={locked}
                          saving={savingStages}
                          highlight={missingFields.includes("codeTest")}
                          onSave={(config) => updateStageConfig(index, config)}
                        />
                      )}
                      {stage.type === "FINAL_OFFER" && (
                        <FinalOfferPanel
                          stageIndex={index}
                          positions={positionsOf(stage.config)}
                          locked={locked}
                          saving={savingStages}
                          onSave={(positions) => updateStageConfig(index, { positions })}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {missingFields.includes("stages") && (
              <p role="alert" className="text-body text-danger-600">
                Adicione ao menos uma etapa antes de publicar.
              </p>
            )}

            {!locked && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Field id="novo-tipo-etapa" label="Tipo de etapa" className="sm:w-72">
                  <Select value={newStageType} onChange={(e) => setNewStageType(e.target.value as StageType)}>
                    {STAGE_TYPES.map((type) => (
                      <option key={type} value={type} disabled={type === "FINAL_OFFER" && hasFinalOffer}>
                        {STAGE_LABEL[type]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button variant="secondary" onClick={addStage} loading={savingStages}>
                  Adicionar etapa
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {jobId && !locked && (
        <div className="flex flex-col gap-3 rounded-card border border-brand-100 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-body text-ink-600">Ao publicar, a vaga aparece para os candidatos e o pipeline fica travado.</p>
          <Button onClick={() => setConfirmPublish(true)} disabled={publishing || savingStages || dirty}>
            Publicar Vaga
          </Button>
        </div>
      )}
      {jobId && !locked && dirty && (
        <p className="text-body text-ink-600">Salve as alterações antes de publicar.</p>
      )}

      <ConfirmDialog
        open={confirmPublish}
        title="Publicar esta vaga?"
        description="Ela passa a aparecer para os candidatos. Tecnologias, requisitos mínimos e etapas do pipeline ficam travados depois disso."
        confirmLabel="Confirmar publicação"
        loading={publishing}
        onCancel={() => setConfirmPublish(false)}
        onConfirm={handlePublish}
      />

      <ConfirmDialog
        open={pendingHref !== null}
        title={jobId ? "Descartar alterações?" : "Descartar rascunho?"}
        description={jobId ? "As alterações feitas nos dados da vaga ainda não foram salvas." : "A vaga ainda não foi salva e o que você preencheu será perdido."}
        confirmLabel="Descartar e sair"
        cancelLabel="Continuar editando"
        tone="danger"
        onCancel={() => setPendingHref(null)}
        onConfirm={() => {
          const href = pendingHref;
          setPendingHref(null);
          setDirty(false);
          dirtyRef.current = false;
          if (href) router.push(href);
        }}
      />
    </div>
  );
}

/** Spec 005 US1: desafio, linguagens (subconjunto das do desafio) e tempo da etapa CODE_TEST. */
function CodeTestConfigPanel({
  stageIndex,
  config,
  catalog,
  locked,
  saving,
  highlight,
  onSave,
}: {
  stageIndex: number;
  config: CodeTestStageConfig;
  catalog: ChallengeOption[] | null;
  locked: boolean;
  saving: boolean;
  highlight: boolean;
  onSave: (config: CodeTestStageConfig) => void;
}) {
  const [challengeId, setChallengeId] = useState(config.challengeId ?? "");
  const [languages, setLanguages] = useState<string[]>(config.languages ?? []);
  const [minutes, setMinutes] = useState(String(config.timeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES));

  useEffect(() => {
    setChallengeId(config.challengeId ?? "");
    setLanguages(config.languages ?? []);
    setMinutes(String(config.timeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES));
  }, [config.challengeId, config.languages, config.timeLimitMinutes]);

  const challenge = catalog?.find((c) => c.id === challengeId) ?? null;
  const complete = isCodeTestConfigComplete(config);
  const minutesNumber = Number(minutes);
  const minutesValid = Number.isInteger(minutesNumber) && minutesNumber >= MIN_TIME_LIMIT_MINUTES && minutesNumber <= MAX_TIME_LIMIT_MINUTES;

  if (catalog === null) {
    return <p className="mt-3 text-body text-ink-600">Carregando catálogo de desafios…</p>;
  }

  if (locked) {
    const saved = catalog.find((c) => c.id === config.challengeId);
    return (
      <p className="mt-3 text-body text-ink-600">
        {saved
          ? `Desafio: ${saved.title} · ${config.timeLimitMinutes ?? DEFAULT_TIME_LIMIT_MINUTES} min · ${(config.languages ?? []).map((l) => LANGUAGE_LABEL[l] ?? l).join(", ")}`
          : "Teste de código sem desafio configurado."}
      </p>
    );
  }

  if (catalog.length === 0) {
    // US4.3: catálogo vazio vira explicação, não um seletor vazio.
    return (
      <Notice tone="warning" className="mt-3" title="Nenhum desafio no catálogo">
        Peça a um administrador para cadastrar um desafio em Desafios antes de publicar esta vaga.
      </Notice>
    );
  }

  return (
    <div className={`mt-3 space-y-3 rounded-card border p-3 ${highlight && !complete ? "border-danger-600/50" : "border-brand-100 bg-canvas"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label text-ink-600">Configuração do teste de código</p>
        <Badge variant={complete ? "success" : "warning"}>{complete ? "Configurado" : "Falta configurar"}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`desafio-etapa-${stageIndex}`} label="Desafio">
          <Select
            value={challengeId}
            onChange={(e) => {
              const next = catalog.find((c) => c.id === e.target.value);
              setChallengeId(e.target.value);
              setLanguages(next ? next.languages : []);
            }}
          >
            <option value="">Escolha um desafio</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({DIFFICULTY_LABEL[c.difficulty] ?? c.difficulty})
              </option>
            ))}
          </Select>
        </Field>
        <Field
          id={`tempo-etapa-${stageIndex}`}
          label="Tempo limite (minutos)"
          error={minutesValid ? undefined : `Entre ${MIN_TIME_LIMIT_MINUTES} e ${MAX_TIME_LIMIT_MINUTES} minutos.`}
        >
          <Input type="number" min={MIN_TIME_LIMIT_MINUTES} max={MAX_TIME_LIMIT_MINUTES} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
      </div>
      {challenge && (
        <fieldset className="space-y-2">
          <legend className="text-label text-ink-600">Linguagens permitidas</legend>
          <div className="flex flex-wrap gap-3">
            {challenge.languages.map((language) => (
              <label key={language} className="flex items-center gap-2 text-body text-ink-900">
                <input
                  type="checkbox"
                  checked={languages.includes(language)}
                  onChange={(e) =>
                    setLanguages((prev) => (e.target.checked ? [...prev, language] : prev.filter((l) => l !== language)))
                  }
                  className="h-4 w-4 accent-brand-900"
                />
                {LANGUAGE_LABEL[language] ?? language}
              </label>
            ))}
          </div>
          <p className="text-label font-normal text-ink-600">
            {challenge.visibleCases.length} caso(s) visível(is) e {challenge.hiddenCaseCount} oculto(s) · até {MAX_TEST_RUNS} execuções de teste por candidato.
          </p>
        </fieldset>
      )}
      <Button
        size="sm"
        variant="secondary"
        loading={saving}
        disabled={!challengeId || languages.length === 0 || !minutesValid}
        onClick={() => onSave({ challengeId, languages, timeLimitMinutes: minutesNumber })}
      >
        Salvar configuração do teste
      </Button>
    </div>
  );
}

function FinalOfferPanel({
  stageIndex,
  positions,
  locked,
  saving,
  onSave,
}: {
  stageIndex: number;
  positions: number;
  locked: boolean;
  saving: boolean;
  onSave: (positions: number) => void;
}) {
  const [value, setValue] = useState(String(positions));
  useEffect(() => setValue(String(positions)), [positions]);
  const number = Number(value);
  const valid = Number.isInteger(number) && number >= MIN_POSITIONS && number <= MAX_POSITIONS;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-card border border-brand-100 bg-canvas p-3 sm:flex-row sm:items-end">
      <Field
        id={`vagas-etapa-${stageIndex}`}
        label="Quantidade de vagas"
        hint="A vaga só é encerrada quando todas forem preenchidas."
        error={valid ? undefined : `Entre ${MIN_POSITIONS} e ${MAX_POSITIONS}.`}
        className="sm:w-72"
      >
        <Input type="number" min={MIN_POSITIONS} max={MAX_POSITIONS} disabled={locked} value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      {!locked && (
        <Button size="sm" variant="secondary" loading={saving} disabled={!valid || number === positions} onClick={() => onSave(number)}>
          Salvar quantidade
        </Button>
      )}
    </div>
  );
}
