"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { STAGE_LABEL } from "@/lib/processStages";
import { apiFetch } from "@/lib/api-client";
import { JOB_STATUS_BADGE, JOB_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardListSkeleton,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Input,
  Select,
  SearchInput,
  focusRing,
} from "@/components/ui";
import { ViewSwitcher } from "../ViewSwitcher";

interface StageCount {
  stageType: string;
  count: number;
}

interface Bottleneck {
  stageType: string;
  count: number;
  avgHoursWaiting: number;
}

interface JobRow {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  recruiter: { id: string; name: string };
  createdAt: string;
  publishedAt: string | null;
  daysOpen: number | null;
  totalCandidates: number;
  byStage: StageCount[];
  conversionRate: number | null;
  bottleneck: Bottleneck | null;
  awaitingDecision: number;
  codeTestPending: number;
  codeTestSubmitted: number;
  daysSinceActivity: number;
  positionsFilled: number;
  positionsTotal: number | null;
}

interface OverviewResult {
  summary: {
    openJobs: number;
    activeCandidates: number;
    awaitingDecision: number;
    hiresInPeriod: number;
    avgDaysToHire: number | null;
  };
  jobs: JobRow[];
  recruiters: Array<{ id: string; name: string }>;
}

// Vaga publicada sem nenhuma movimentação há esse tanto de tempo: destaque de "parada".
const STALLED_DAYS = 7;

type SortKey = "title" | "daysOpen" | "totalCandidates" | "conversionRate" | "bottleneck" | "awaitingDecision" | "codeTestPending" | "activity" | "positions";

const SORT_VALUE: Record<SortKey, (job: JobRow) => number | string> = {
  title: (j) => j.title.toLowerCase(),
  daysOpen: (j) => j.daysOpen ?? -1,
  totalCandidates: (j) => j.totalCandidates,
  conversionRate: (j) => j.conversionRate ?? -1,
  bottleneck: (j) => j.bottleneck?.count ?? 0,
  awaitingDecision: (j) => j.awaitingDecision,
  codeTestPending: (j) => j.codeTestPending,
  activity: (j) => j.daysSinceActivity,
  positions: (j) => (j.positionsTotal ? j.positionsFilled / j.positionsTotal : j.positionsFilled),
};

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "title", label: "Vaga" },
  { key: "daysOpen", label: "Dias aberta" },
  { key: "totalCandidates", label: "Candidatos" },
  { key: "conversionRate", label: "Conversão" },
  { key: "bottleneck", label: "Gargalo" },
  { key: "awaitingDecision", label: "Aguardando decisão" },
  { key: "codeTestPending", label: "Teste de código" },
  { key: "activity", label: "Última atividade" },
  { key: "positions", label: "Posições" },
];

function formatDays(n: number | null): string {
  if (n === null) return "—";
  if (n <= 0) return "hoje";
  return n === 1 ? "1 dia" : `${n} dias`;
}

function formatHours(hours: number): string {
  if (hours < 1) return "menos de 1h";
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)} dias`;
}

function formatPercent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function MetricCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-label text-fg-muted">{label}</p>
      <p className="mt-1 break-words font-display text-[22px] font-semibold leading-7 tabular-nums text-fg sm:text-[26px]">{value}</p>
      {hint && <p className="mt-1 text-label font-normal text-fg-muted">{hint}</p>}
    </Card>
  );
}

// aria-sort vive no <th> (WAI-ARIA), não no botão — ele só aciona a troca.
function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-label font-semibold text-fg-muted hover:text-fg", focusRing)}
    >
      {label}
      <Icon name="chevronDown" className={cn("h-3 w-3 transition-transform", active && dir === "asc" && "rotate-180", !active && "opacity-30")} />
    </button>
  );
}

export function VisaoGeralVagas() {
  const [status, setStatus] = useState("");
  const [recruiterId, setRecruiterId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "activity", dir: "desc" });

  const [data, setData] = useState<OverviewResult | null>(null);
  const [failed, setFailed] = useState(false);

  // Troca de filtro dispara um novo fetch antes do anterior responder; sem isto, a resposta
  // mais lenta e desatualizada pode chegar por último e sobrescrever o filtro mais recente.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setFailed(false);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (recruiterId) params.set("recrutador", recruiterId);
    if (from) params.set("de", from);
    if (to) params.set("ate", to);
    if (search) params.set("busca", search);
    const result = await apiFetch<OverviewResult>(`/api/recruiter/jobs/overview?${params.toString()}`);
    if (id !== requestId.current) return; // uma requisição mais nova já está em andamento
    if (result.ok && Array.isArray(result.data?.jobs)) setData(result.data);
    else setFailed(true);
  }, [status, recruiterId, from, to, search]);

  useEffect(() => {
    load();
  }, [load]);

  function ariaSortOf(key: SortKey): "ascending" | "descending" | "none" {
    return sort.key !== key ? "none" : sort.dir === "asc" ? "ascending" : "descending";
  }

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "title" ? "asc" : "desc" }));
  }

  const sortedJobs = useMemo(() => {
    if (!data) return [];
    const getter = SORT_VALUE[sort.key];
    return [...data.jobs].sort((a, b) => {
      const av = getter(a);
      const bv = getter(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sort]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  const header = <PageHeader title="Visão geral das vagas" subtitle="Todas as vagas de uma vez — por onde agir primeiro." />;

  if (failed) {
    return (
      <>
        <ViewSwitcher />
        {header}
        <ErrorState title="Não conseguimos carregar a visão geral." onRetry={load} />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <ViewSwitcher />
        {header}
        <CardListSkeleton label="Carregando visão geral…" />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <ViewSwitcher />
      {header}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
        <MetricCard label="Vagas abertas" value={data.summary.openJobs} />
        <MetricCard label="Candidatos ativos" value={data.summary.activeCandidates} />
        <MetricCard label="Aguardando decisão" value={data.summary.awaitingDecision} />
        <MetricCard label="Contratações no período" value={data.summary.hiresInPeriod} />
        <MetricCard label="Tempo médio até contratar" value={data.summary.avgDaysToHire !== null ? `${data.summary.avgDaysToHire}d` : "—"} />
      </section>

      <Card className="p-4 sm:p-6">
        <form onSubmit={handleSearchSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field id="vg-busca" label="Buscar por título">
            <SearchInput value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Nome da vaga" />
          </Field>
          <Field id="vg-status" label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicada</option>
              <option value="CLOSED">Encerrada</option>
            </Select>
          </Field>
          <Field id="vg-recrutador" label="Recrutador responsável">
            <Select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)}>
              <option value="">Todos</option>
              {data.recruiters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="vg-de" label="Publicada de">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field id="vg-ate" label="até">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" className="w-full sm:w-auto">
              Buscar
            </Button>
          </div>
        </form>
      </Card>

      {data.jobs.length === 0 ? (
        <EmptyState
          title="Nenhuma vaga encontrada."
          description="Ajuste os filtros ou crie uma vaga para começar."
          action={<ButtonLink href="/recrutamento/vagas/nova">Criar vaga</ButtonLink>}
        />
      ) : (
        <>
          {/* Desktop: tabela densa, com rolagem horizontal se a janela for estreita. */}
          <div className="hidden overflow-x-auto rounded-card border border-line bg-surface lg:block">
            <table className="w-full min-w-[1100px] border-collapse text-body">
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" aria-sort={ariaSortOf("title")} className="px-4 py-3">
                    <SortButton label="Vaga" active={sort.key === "title"} dir={sort.dir} onClick={() => toggleSort("title")} />
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  {COLUMNS.slice(1).map((col) => (
                    <th scope="col" key={col.key} aria-sort={ariaSortOf(col.key)} className="px-4 py-3">
                      <SortButton label={col.label} active={sort.key === col.key} dir={sort.dir} onClick={() => toggleSort(col.key)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedJobs.map((job) => {
                  const stalled = job.status === "PUBLISHED" && job.daysSinceActivity >= STALLED_DAYS;
                  return (
                    <tr
                      key={job.id}
                      className={cn("relative border-b border-line last:border-0 hover:bg-page", stalled && "bg-warning/5")}
                    >
                      <td className="max-w-[220px] px-4 py-3">
                        <Link
                          href={`/recrutamento/vagas/${job.id}/candidaturas`}
                          className={cn("break-words rounded-sm font-medium text-fg after:absolute after:inset-0 hover:underline", focusRing)}
                        >
                          {job.title}
                        </Link>
                        <p className="truncate text-label text-fg-muted">{job.recruiter.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={JOB_STATUS_BADGE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge>
                          {stalled && <Badge variant="warning">Parada</Badge>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-fg-muted">{formatDays(job.daysOpen)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold tabular-nums text-fg">{job.totalCandidates}</p>
                        {job.byStage.some((s) => s.count > 0) && (
                          <div className="mt-1 flex max-w-[220px] flex-wrap gap-1">
                            {job.byStage
                              .filter((s) => s.count > 0)
                              .map((s) => (
                                <Badge key={s.stageType} variant="muted" className="text-[11px]">
                                  {STAGE_LABEL[s.stageType] ?? s.stageType} {s.count}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-fg-muted">{formatPercent(job.conversionRate)}</td>
                      <td className="px-4 py-3">
                        {job.bottleneck ? (
                          <>
                            <Badge variant="warning">{STAGE_LABEL[job.bottleneck.stageType] ?? job.bottleneck.stageType}</Badge>
                            <p className="mt-1 text-label text-fg-muted">
                              {job.bottleneck.count} {job.bottleneck.count === 1 ? "pessoa" : "pessoas"} · {formatHours(job.bottleneck.avgHoursWaiting)}
                            </p>
                          </>
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-fg-muted">{job.awaitingDecision}</td>
                      <td className="px-4 py-3">
                        {job.codeTestPending === 0 && job.codeTestSubmitted === 0 ? (
                          <span className="text-fg-muted">—</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {job.codeTestPending > 0 && <Badge variant="warning">{job.codeTestPending} pendente{job.codeTestPending > 1 ? "s" : ""}</Badge>}
                            {job.codeTestSubmitted > 0 && <Badge variant="muted">{job.codeTestSubmitted} enviado{job.codeTestSubmitted > 1 ? "s" : ""}</Badge>}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-fg-muted">{formatDays(job.daysSinceActivity)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-fg-muted">
                        {job.positionsFilled}/{job.positionsTotal ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile/tablet: um cartão por vaga. */}
          <ul className="space-y-3 lg:hidden">
            {sortedJobs.map((job) => {
              const stalled = job.status === "PUBLISHED" && job.daysSinceActivity >= STALLED_DAYS;
              return (
                <Card as="li" key={job.id} className={cn("relative space-y-3 p-4", stalled && "bg-warning/5")}>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 text-h3">
                      <Link
                        href={`/recrutamento/vagas/${job.id}/candidaturas`}
                        className={cn("break-words rounded-sm text-fg after:absolute after:inset-0 hover:underline", focusRing)}
                      >
                        {job.title}
                      </Link>
                    </h2>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={JOB_STATUS_BADGE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge>
                      {stalled && <Badge variant="warning">Parada</Badge>}
                    </div>
                  </div>
                  <p className="text-label text-fg-muted">
                    {job.recruiter.name} · {formatDays(job.daysOpen)} aberta
                  </p>

                  <dl className="grid grid-cols-2 gap-3 text-body">
                    <div>
                      <dt className="text-label text-fg-muted">Candidatos</dt>
                      <dd className="font-semibold tabular-nums text-fg">{job.totalCandidates}</dd>
                    </div>
                    <div>
                      <dt className="text-label text-fg-muted">Conversão</dt>
                      <dd className="font-semibold tabular-nums text-fg">{formatPercent(job.conversionRate)}</dd>
                    </div>
                    <div>
                      <dt className="text-label text-fg-muted">Aguardando decisão</dt>
                      <dd className="font-semibold tabular-nums text-fg">{job.awaitingDecision}</dd>
                    </div>
                    <div>
                      <dt className="text-label text-fg-muted">Posições</dt>
                      <dd className="font-semibold tabular-nums text-fg">
                        {job.positionsFilled}/{job.positionsTotal ?? "—"}
                      </dd>
                    </div>
                  </dl>

                  {job.byStage.some((s) => s.count > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {job.byStage
                        .filter((s) => s.count > 0)
                        .map((s) => (
                          <Badge key={s.stageType} variant="muted">
                            {STAGE_LABEL[s.stageType] ?? s.stageType} {s.count}
                          </Badge>
                        ))}
                    </div>
                  )}

                  {job.bottleneck && (
                    <p className="text-body text-fg-muted">
                      Gargalo: <Badge variant="warning">{STAGE_LABEL[job.bottleneck.stageType] ?? job.bottleneck.stageType}</Badge>{" "}
                      {job.bottleneck.count} {job.bottleneck.count === 1 ? "pessoa" : "pessoas"} · {formatHours(job.bottleneck.avgHoursWaiting)}
                    </p>
                  )}

                  {(job.codeTestPending > 0 || job.codeTestSubmitted > 0) && (
                    <p className="flex flex-wrap items-center gap-2 text-body text-fg-muted">
                      Teste de código:
                      {job.codeTestPending > 0 && <Badge variant="warning">{job.codeTestPending} pendente{job.codeTestPending > 1 ? "s" : ""}</Badge>}
                      {job.codeTestSubmitted > 0 && <Badge variant="muted">{job.codeTestSubmitted} enviado{job.codeTestSubmitted > 1 ? "s" : ""}</Badge>}
                    </p>
                  )}

                  <p className="text-label text-fg-muted">Última atividade: {formatDays(job.daysSinceActivity)}</p>
                </Card>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
