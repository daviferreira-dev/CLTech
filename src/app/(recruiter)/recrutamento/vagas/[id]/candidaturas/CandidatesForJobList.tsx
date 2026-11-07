"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STAGE_LABEL, RECOMMENDATION_THRESHOLD } from "@/lib/processStages";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { BULK_DECISION_MAX, type RejectionInput } from "@/lib/validation/applications";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RejectDialog } from "@/components/recruiter/RejectDialog";
import { APPLICATION_STATUS_BADGE, RECRUITER_APPLICATION_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Card,
  CardListSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Notice,
  Select,
  focusRing,
  matchVariant,
} from "@/components/ui";

interface JobApplicationListItem {
  id: string;
  candidateName: string;
  currentStageType: string;
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  matchScore: number | null;
}

interface JobSummary {
  id: string;
  title: string;
  stages: Array<{ type: string; order: number }>;
}

interface BulkDecisionResult {
  done: Array<{ id: string; name: string }>;
  skipped: Array<{ id: string; name: string }>;
  failed: Array<{ id: string; name: string; message: string }>;
}

/** Resumo do lote em uma frase: "12 reprovados, 2 ignorados (já finalizados)…". */
function bulkSummary(result: BulkDecisionResult, decision: "ADVANCE" | "REJECT"): string {
  const plural = (n: number) => (n === 1 ? "" : "s");
  const verb = decision === "REJECT" ? "reprovado" : "avançado";
  const parts = [`${result.done.length} ${verb}${plural(result.done.length)}`];
  if (result.skipped.length > 0) {
    parts.push(`${result.skipped.length} ignorado${plural(result.skipped.length)} (já finalizado${plural(result.skipped.length)})`);
  }
  if (result.failed.length > 0) {
    parts.push(`${result.failed.length} com erro: ${result.failed.map((f) => `${f.name} (${f.message})`).join("; ")}`);
  }
  return `${parts.join(", ")}.`;
}

function timeInStage(enteredAt: string | undefined): string | null {
  if (!enteredAt) return null;
  const hours = (Date.now() - new Date(enteredAt).getTime()) / 3_600_000;
  if (hours < 1) return "menos de 1 hora";
  if (hours < 48) return Math.floor(hours) === 1 ? "1 hora" : `${Math.floor(hours)} horas`;
  return `${Math.floor(hours / 24)} dias`;
}

export function CandidatesForJobList({ jobId, enteredAtById }: { jobId: string; enteredAtById: Record<string, string> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Recorte por etapa vem na URL (do painel, spec 004 US5.1) e é preservado no ida-e-volta.
  const stageFilter = searchParams.get("etapa") ?? "";
  // Vindo da decisão no relatório: avisa quem foi aprovado e para onde seguiu.
  const approvedName = searchParams.get("aprovado");
  const approvedTo = searchParams.get("destino");

  const [items, setItems] = useState<JobApplicationListItem[] | null>(null);
  const [job, setJob] = useState<JobSummary | null>(null);
  const [failed, setFailed] = useState(false);
  // Spec 009: seleção para decisão em lote (só candidaturas em andamento).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState<"ADVANCE" | "REJECT" | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    setItems(null);
    const [apps, jobResult] = await Promise.all([
      apiFetch<{ items: JobApplicationListItem[] }>(`/api/recruiter/jobs/${jobId}/applications`),
      apiFetch<JobSummary>(`/api/recruiter/jobs/${jobId}`),
    ]);
    if (jobResult.ok) setJob(jobResult.data);
    // Resposta de erro não traz `items`: sem esta guarda, `items.length` derruba a página.
    if (apps.ok && Array.isArray(apps.data?.items)) setItems(apps.data.items);
    else setFailed(true);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  function setStage(stage: string) {
    router.replace(stage ? `${pathname}?etapa=${stage}` : pathname, { scroll: false });
  }

  const visible = items?.filter((item) => !stageFilter || item.currentStageType === stageFilter) ?? null;
  const selectable = visible?.filter((item) => item.status === "IN_PROGRESS") ?? [];
  const selectedVisible = selectable.filter((item) => selected.has(item.id));
  const allSelected = selectable.length > 0 && selectedVisible.length === selectable.length;
  const overLimit = selectedVisible.length > BULK_DECISION_MAX;
  const countLabel = `${selectedVisible.length} candidato${selectedVisible.length === 1 ? "" : "s"}`;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((item) => item.id)));
  }

  async function runBulk(decision: "ADVANCE" | "REJECT", rejection?: RejectionInput) {
    if (bulkSaving) return;
    setBulkSaving(true);
    setBulkMessage(null);
    const result = await apiFetch<BulkDecisionResult>(
      `/api/recruiter/jobs/${jobId}/applications/bulk-decision`,
      jsonInit("POST", { applicationIds: selectedVisible.map((item) => item.id), decision, rejection }),
    );
    setBulkSaving(false);
    setBulkPending(null);
    if (result.ok) {
      setBulkMessage({ tone: result.data.failed.length > 0 ? "warning" : "success", text: bulkSummary(result.data, decision) });
      setSelected(new Set());
      await load();
      return;
    }
    if (result.status === 401) return;
    setBulkMessage({
      tone: "danger",
      text: result.networkError ? NETWORK_ERROR_MESSAGE : (result.error?.message ?? "Não foi possível registrar a decisão."),
    });
  }
  const stageTypes = job ? [...new Set(job.stages.map((s) => s.type))] : [];
  const reportQuery = stageFilter ? `?etapa=${stageFilter}` : "";

  return (
    <>
      {approvedName && (
        <Notice tone="success" className="mb-4">
          {approvedTo === "FINAL"
            ? `${approvedName} passou na última etapa. Processo concluído.`
            : `${approvedName} passou de etapa e agora está em: ${approvedTo}.`}
        </Notice>
      )}
      {/* O título da vaga fica fixo no topo enquanto se percorre a lista (US5.2). */}
      <div className="-mx-4 bg-page/95 px-4 pb-2 pt-2 backdrop-blur sm:-mx-6 sm:px-6 md:sticky md:top-16 md:z-10">
        <PageHeader
          className="mb-4 sm:mb-4"
          breadcrumb={
            <Breadcrumb
              items={[
                { label: "Painel", href: "/recrutamento" },
                { label: job?.title ?? "Vaga", href: `/recrutamento/vagas/${jobId}` },
                { label: "Candidaturas" },
              ]}
            />
          }
          title={job?.title ?? "Candidaturas"}
          subtitle={visible ? `Candidaturas · ${visible.length} ${visible.length === 1 ? "pessoa" : "pessoas"}${stageFilter ? " nesta etapa" : ""}` : "Candidaturas"}
        />
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Field id="filtro-etapa" label="Etapa" className="sm:w-72">
          <Select value={stageFilter} onChange={(e) => setStage(e.target.value)}>
            <option value="">Todas as etapas</option>
            {stageTypes.map((type) => (
              <option key={type} value={type}>
                {STAGE_LABEL[type] ?? type}
              </option>
            ))}
          </Select>
        </Field>
        {stageFilter && (
          <div className="flex items-center gap-2">
            <span className="text-label text-fg-muted">Recorte:</span>
            <Chip tone="active" onRemove={() => setStage("")} removeLabel="Remover recorte de etapa">
              {STAGE_LABEL[stageFilter] ?? stageFilter}
            </Chip>
          </div>
        )}
      </div>

      {failed && <ErrorState title="Não conseguimos carregar as candidaturas." onRetry={load} action={<ButtonLink href="/recrutamento/vagas" variant="ghost">Voltar para Minhas vagas</ButtonLink>} />}
      {!failed && visible === null && <CardListSkeleton label="Carregando candidaturas…" />}

      {visible !== null && visible.length === 0 && (
        <EmptyState
          title={stageFilter ? "Nenhum candidato nesta etapa." : "Nenhum candidato inscrito ainda."}
          description={stageFilter ? "Remova o recorte para ver todas as candidaturas da vaga." : "Assim que alguém se candidatar, aparece aqui."}
          action={
            stageFilter ? (
              <ButtonLink href={pathname} variant="secondary">
                Ver todas as etapas
              </ButtonLink>
            ) : (
              <ButtonLink href={`/recrutamento/vagas/${jobId}`} variant="secondary">
                Ver a vaga
              </ButtonLink>
            )
          }
        />
      )}

      {bulkMessage && (
        <Notice tone={bulkMessage.tone} className="mb-4">
          {bulkMessage.text}
        </Notice>
      )}

      {selectable.length > 0 && (
        <div className="mb-3 flex flex-col gap-3 rounded-card border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <label className="flex items-center gap-2 text-body text-fg">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-action" />
            Selecionar todos em andamento
            {selectedVisible.length > 0 && <span className="text-fg-muted">· {selectedVisible.length} selecionado{selectedVisible.length === 1 ? "" : "s"}</span>}
          </label>
          {selectedVisible.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setBulkPending("ADVANCE")} disabled={bulkSaving || overLimit}>
                Avançar selecionados
              </Button>
              <Button size="sm" variant="danger" onClick={() => setBulkPending("REJECT")} disabled={bulkSaving || overLimit}>
                Reprovar selecionados
              </Button>
            </div>
          )}
        </div>
      )}
      {overLimit && (
        <p role="alert" className="mb-3 text-body text-danger">
          Selecione no máximo {BULK_DECISION_MAX} candidatos por vez.
        </p>
      )}

      {visible && visible.length > 0 && (
        <ul className="space-y-3">
          {visible.map((item) => {
            const elapsed = item.status === "IN_PROGRESS" ? timeInStage(enteredAtById[item.id]) : null;
            return (
              <Card as="li" key={item.id} className="relative flex flex-col transition-colors hover:border-action/40 gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  {item.status === "IN_PROGRESS" && (
                    // z-10: acima do link que cobre o cartão inteiro (after:inset-0).
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      aria-label={`Selecionar ${item.candidateName}`}
                      className="relative z-10 mt-1.5 h-4 w-4 shrink-0 accent-action"
                    />
                  )}
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={`/recrutamento/vagas/${jobId}/candidaturas/${item.id}${reportQuery}`}
                      className={cn("break-words rounded-sm text-h3 text-fg after:absolute after:inset-0 hover:underline", focusRing)}
                    >
                      {item.candidateName}
                    </Link>
                    <p className="text-body text-fg-muted">
                      {STAGE_LABEL[item.currentStageType] ?? item.currentStageType}
                      {elapsed && ` · na etapa há ${elapsed}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {item.matchScore !== null && <Badge variant={matchVariant(item.matchScore)}>{item.matchScore}% de compatibilidade</Badge>}
                  {item.status === "IN_PROGRESS" && item.matchScore !== null && (
                    item.matchScore >= RECOMMENDATION_THRESHOLD ? (
                      <Badge variant="success">Recomendado</Badge>
                    ) : (
                      <Badge variant="warning">Não recomendado</Badge>
                    )
                  )}
                  <Badge variant={APPLICATION_STATUS_BADGE[item.status]}>{RECRUITER_APPLICATION_STATUS_LABEL[item.status]}</Badge>
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={bulkPending === "ADVANCE"}
        title={`Avançar ${countLabel}?`}
        description="Cada um vai para a próxima etapa e recebe o e-mail dela. Quem estiver na última etapa é aprovado."
        confirmLabel="Confirmar avanço"
        loading={bulkSaving}
        onCancel={() => setBulkPending(null)}
        onConfirm={() => runBulk("ADVANCE")}
      />
      <RejectDialog
        open={bulkPending === "REJECT"}
        title={`Reprovar ${countLabel}?`}
        description="O mesmo motivo e o mesmo retorno valem para todos. Cada um recebe o e-mail de reprovação. Não dá para desfazer."
        confirmLabel="Confirmar reprovação"
        loading={bulkSaving}
        onCancel={() => setBulkPending(null)}
        onConfirm={(rejection) => runBulk("REJECT", rejection)}
      />
    </>
  );
}
