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
  Notice,
  Select,
  textLinkClasses,
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
    <Card className="p-3 sm:p-6">
      <p className="text-label text-fg-muted">{label}</p>
      <p className="mt-1 break-words font-display text-[24px] font-semibold leading-8 tabular-nums text-fg sm:text-display">{value}</p>
      {hint && <p className="mt-1 text-label font-normal text-fg-muted sm:text-body">{hint}</p>}
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
      title="Painel"
      subtitle="Acompanhe suas vagas e onde cada candidato está no funil."
      actions={<ButtonLink href="/recrutamento/vagas/nova">Criar vaga</ButtonLink>}
    />
  );

  if (failed) {
    return (
      <>
        {header}
        <ErrorState title="Não conseguimos carregar o painel." onRetry={load} action={<ButtonLink href="/recrutamento/vagas" variant="ghost">Ir para Minhas vagas</ButtonLink>} />
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
  const bottleneckHours = data.funnel.avgTimePerStageHours.find((item) => item.stageType === bottleneck)?.hours;
  const totalOf = (job: (typeof data.jobs)[number]) => job.candidatesByStage.reduce((sum, item) => sum + item.count, 0);
  // Vaga com gente na frente; rascunho por último (e mais discreto no cartão).
  const jobs = [...data.jobs].sort((a, b) => Number(a.status === "DRAFT") - Number(b.status === "DRAFT") || totalOf(b) - totalOf(a));

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

      {/* O dado mais acionável do painel lidera: onde os candidatos estão parados. */}
      {bottleneck && (
        <Notice
          tone="warning"
          title={`Gargalo do funil: ${STAGE_LABEL[bottleneck] ?? bottleneck}`}
          action={
            selectedJobId ? (
              <ButtonLink href={`/recrutamento/vagas/${selectedJobId}/candidaturas?etapa=${bottleneck}`} variant="secondary" size="sm">
                Ver quem está nesta etapa
              </ButtonLink>
            ) : undefined
          }
        >
          É a etapa com maior tempo médio
          {bottleneckHours !== undefined ? ` (${bottleneckHours < 1 ? "menos de 1 hora" : `${Math.round(bottleneckHours)} horas`})` : ""}.
          {!selectedJobId && " Recorte por vaga para ver quem está parado nela."}
        </Notice>
      )}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 sm:gap-4">
        <MetricCard label="Vagas publicadas" value={published} hint={`de ${data.jobs.length} no recorte`} />
        <MetricCard label="Candidaturas em andamento" value={inProgress} />
      </section>

      <section aria-labelledby="vagas-painel" className="space-y-4">
        <h2 id="vagas-painel" className="sr-only">
          Vagas
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <Card key={job.id} className={cn("flex flex-col", job.status === "DRAFT" && "border-dashed bg-page")}>
              <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
                <h2 className="min-w-0 text-h3">
                  <Link
                    href={`/recrutamento/vagas/${job.id}/candidaturas`}
                    className={cn("inline-flex min-h-6 items-center break-words rounded-sm text-fg hover:underline", focusRing)}
                  >
                    {job.title}
                  </Link>
                </h2>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={JOB_STATUS_BADGE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge>
                  {job.status !== "DRAFT" && (
                    <span className="text-label font-normal text-fg-muted">
                      {totalOf(job)} {totalOf(job) === 1 ? "candidato" : "candidatos"}
                    </span>
                  )}
                </span>
              </div>
              <CardBody className="flex-1">
                {job.candidatesByStage.length === 0 ? (
                  <p className="text-body text-fg-muted">
                    Pipeline ainda não configurado.{" "}
                    <Link href={`/recrutamento/vagas/${job.id}`} className={cn(textLinkClasses, "inline-flex min-h-6 items-center")}>
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
                              "flex items-center justify-between gap-2 rounded-field px-2 py-1.5 text-body text-fg-muted hover:bg-page hover:text-fg",
                              focusRing,
                            )}
                          >
                            <span className="min-w-0 break-words">{label}</span>
                            <span className="shrink-0 font-semibold tabular-nums text-fg">{item.count}</span>
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
            <p className="text-body text-fg-muted">Ainda sem movimentação suficiente para calcular métricas.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.funnel.avgTimePerStageHours.map((item) => {
                const rate = data.funnel.advanceRatePerStage.find((r) => r.stageType === item.stageType);
                const isBottleneck = item.stageType === bottleneck;
                return (
                  <div
                    key={item.stageType}
                    className={cn("rounded-card border p-4", isBottleneck ? "border-warning/60 bg-warning/5" : "border-line")}
                  >
                    <p className="flex items-center justify-between gap-2 text-body font-medium text-fg">
                      {STAGE_LABEL[item.stageType] ?? item.stageType}
                      {isBottleneck && <Badge variant="warning">Gargalo</Badge>}
                    </p>
                    <p className="mt-1 text-body text-fg-muted">Tempo médio: {item.hours}h</p>
                    {rate && <p className="text-body text-fg-muted">Taxa de avanço: {Math.round(rate.rate * 100)}%</p>}
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
