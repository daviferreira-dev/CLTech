"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STAGE_LABEL } from "@/lib/processStages";
import { apiFetch } from "@/lib/api-client";
import { JOB_STATUS_BADGE, JOB_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardListSkeleton,
  EmptyState,
  ErrorState,
  Field,
  Select,
  focusRing,
} from "@/components/ui";

interface DashboardJob {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  candidatesByStage: Array<{ stageType: string; count: number }>;
}

interface DashboardResult {
  jobs: DashboardJob[];
  funnel: {
    avgTimePerStageHours: Array<{ stageType: string; hours: number }>;
    advanceRatePerStage: Array<{ stageType: string; rate: number }>;
    bottleneckStageType: string | null;
  };
}

function MetricCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4 sm:p-6">
      <p className="text-label text-ink-600">{label}</p>
      <p className="mt-1 break-words text-display text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-body text-ink-600">{hint}</p>}
    </Card>
  );
}

export function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // O recorte por vaga vive na URL (spec 004 FR-102): sobrevive a voltar e recarregar.
  const selectedJobId = searchParams.get("vaga") ?? "";

  const [data, setData] = useState<DashboardResult | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const url = selectedJobId ? `/api/recruiter/dashboard?jobId=${encodeURIComponent(selectedJobId)}` : "/api/recruiter/dashboard";
    const result = await apiFetch<DashboardResult>(url);
    if (result.ok && Array.isArray(result.data?.jobs)) setData(result.data);
    else setFailed(true);
  }, [selectedJobId]);

  useEffect(() => {
    load();
  }, [load]);

  // Lista completa de vagas para o seletor, mesmo quando o painel está recortado em uma só.
  const [allJobs, setAllJobs] = useState<Array<{ id: string; title: string }>>([]);
  useEffect(() => {
    if (data && !selectedJobId) setAllJobs(data.jobs.map((job) => ({ id: job.id, title: job.title })));
  }, [data, selectedJobId]);
  useEffect(() => {
    if (!selectedJobId || allJobs.length > 0) return;
    apiFetch<DashboardResult>("/api/recruiter/dashboard").then((result) => {
      if (result.ok) setAllJobs(result.data.jobs.map((job) => ({ id: job.id, title: job.title })));
    });
  }, [selectedJobId, allJobs.length]);

  function selectJob(jobId: string) {
    router.replace(jobId ? `${pathname}?vaga=${encodeURIComponent(jobId)}` : pathname, { scroll: false });
  }

  const header = (
    <PageHeader
      title="Painel de Recrutamento"
      subtitle="Acompanhe suas vagas e onde cada candidato está no funil."
      actions={<ButtonLink href="/recrutamento/vagas/nova">Criar Vaga</ButtonLink>}
    />
  );

  if (failed) {
    return (
      <>
        {header}
        <ErrorState title="Não foi possível carregar o painel." onRetry={load} />
      </>
    );
  }

  if (!data) {
    return (
      <>
        {header}
        <CardListSkeleton label="Carregando painel…" />
      </>
    );
  }

  if (data.jobs.length === 0 && !selectedJobId) {
    return (
      <>
        {header}
        <EmptyState
          title="Nenhuma vaga ainda."
          description="Crie uma vaga, monte o pipeline de seleção e publique para começar a receber candidaturas."
          action={<ButtonLink href="/recrutamento/vagas/nova">Criar a primeira vaga</ButtonLink>}
        />
      </>
    );
  }

  const inProgress = data.jobs.reduce((sum, job) => sum + job.candidatesByStage.reduce((s, item) => s + item.count, 0), 0);
  const published = data.jobs.filter((job) => job.status === "PUBLISHED").length;
  const bottleneck = data.funnel.bottleneckStageType;

  return (
    <div className="space-y-8">
      {header}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Field id="painel-vaga" label="Recortar por vaga" className="sm:w-80">
          <Select value={selectedJobId} onChange={(e) => selectJob(e.target.value)}>
            <option value="">Todas as vagas</option>
            {(allJobs.length > 0 ? allJobs : data.jobs).map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Vagas publicadas" value={published} hint={`de ${data.jobs.length} no recorte`} />
        <MetricCard label="Candidaturas em andamento" value={inProgress} />
        <MetricCard label="Gargalo do funil" value={bottleneck ? (STAGE_LABEL[bottleneck] ?? bottleneck) : "—"} hint={bottleneck ? "Etapa com maior tempo médio" : "Sem movimentação suficiente"} />
      </section>

      <section aria-labelledby="vagas-painel" className="space-y-4">
        <h2 id="vagas-painel" className="sr-only">
          Vagas
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.jobs.map((job) => (
            <Card key={job.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
                <h2 className="min-w-0 text-h3">
                  <Link
                    href={`/recrutamento/vagas/${job.id}/candidaturas`}
                    className={cn("break-words rounded-sm text-ink-900 hover:underline", focusRing)}
                  >
                    {job.title}
                  </Link>
                </h2>
                <Badge variant={JOB_STATUS_BADGE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge>
              </div>
              <CardBody className="flex-1">
                {job.candidatesByStage.length === 0 ? (
                  <p className="text-body text-ink-600">
                    Pipeline ainda não configurado.{" "}
                    <Link href={`/recrutamento/vagas/${job.id}`} className="font-medium text-brand-900 underline">
                      Configurar
                    </Link>
                  </p>
                ) : (
                  <ul className="space-y-1" aria-label={`Candidatos por etapa em ${job.title}`}>
                    {job.candidatesByStage.map((item, index) => {
                      const label = STAGE_LABEL[item.stageType] ?? item.stageType;
                      return (
                        <li key={`${item.stageType}-${index}`}>
                          {/* US5.1: a contagem leva à lista já recortada naquela etapa. */}
                          <Link
                            href={`/recrutamento/vagas/${job.id}/candidaturas?etapa=${item.stageType}`}
                            aria-label={`${item.count} em ${label} — ver candidaturas`}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-field px-2 py-1.5 text-body text-ink-600 hover:bg-canvas hover:text-ink-900",
                              focusRing,
                            )}
                          >
                            <span className="min-w-0 break-words">{label}</span>
                            <span className="shrink-0 font-semibold tabular-nums text-ink-900">{item.count}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <Card as="section" aria-labelledby="metricas-funil">
        <CardHeader titleId="metricas-funil" title="Métricas do funil" />
        <CardBody>
          {data.funnel.avgTimePerStageHours.length === 0 ? (
            <p className="text-body text-ink-600">Ainda sem movimentação suficiente para calcular métricas.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.funnel.avgTimePerStageHours.map((item) => {
                const rate = data.funnel.advanceRatePerStage.find((r) => r.stageType === item.stageType);
                const isBottleneck = item.stageType === bottleneck;
                return (
                  <div
                    key={item.stageType}
                    className={cn("rounded-card border p-4", isBottleneck ? "border-warning-500/60 bg-warning-500/5" : "border-brand-100")}
                  >
                    <p className="flex items-center justify-between gap-2 text-body font-medium text-ink-900">
                      {STAGE_LABEL[item.stageType] ?? item.stageType}
                      {isBottleneck && <Badge variant="warning">Gargalo</Badge>}
                    </p>
                    <p className="mt-1 text-body text-ink-600">Tempo médio: {item.hours}h</p>
                    {rate && <p className="text-body text-ink-600">Taxa de avanço: {Math.round(rate.rate * 100)}%</p>}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
