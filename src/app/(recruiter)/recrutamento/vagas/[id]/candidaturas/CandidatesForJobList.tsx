"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STAGE_LABEL, RECOMMENDATION_THRESHOLD } from "@/lib/processStages";
import { apiFetch } from "@/lib/api-client";
import { APPLICATION_STATUS_BADGE, RECRUITER_APPLICATION_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Breadcrumb,
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

function timeInStage(enteredAt: string | undefined): string | null {
  if (!enteredAt) return null;
  const hours = (Date.now() - new Date(enteredAt).getTime()) / 3_600_000;
  if (hours < 1) return "menos de 1h";
  if (hours < 48) return `${Math.floor(hours)}h`;
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
  const stageTypes = job ? [...new Set(job.stages.map((s) => s.type))] : [];
  const reportQuery = stageFilter ? `?etapa=${stageFilter}` : "";

  return (
    <>
      {approvedName && (
        <Notice tone="success" className="mb-4">
          {approvedTo === "FINAL"
            ? `${approvedName} foi aprovado(a) na última etapa.`
            : `${approvedName} foi aprovado(a) e avançou para: ${approvedTo}.`}
        </Notice>
      )}
      {/* O título da vaga fica fixo no topo enquanto se percorre a lista (US5.2). */}
      <div className="-mx-4 bg-canvas/95 px-4 pb-2 pt-2 backdrop-blur sm:-mx-6 sm:px-6 md:sticky md:top-16 md:z-10">
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
          title={job ? `Candidatos — ${job.title}` : "Candidatos"}
          subtitle={visible ? `${visible.length} ${visible.length === 1 ? "candidatura" : "candidaturas"}${stageFilter ? " nesta etapa" : ""}` : undefined}
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
            <span className="text-label text-ink-600">Recorte:</span>
            <Chip tone="active" onRemove={() => setStage("")} removeLabel="Remover recorte de etapa">
              {STAGE_LABEL[stageFilter] ?? stageFilter}
            </Chip>
          </div>
        )}
      </div>

      {failed && <ErrorState title="Não foi possível carregar as candidaturas." onRetry={load} />}
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

      {visible && visible.length > 0 && (
        <ul className="space-y-3">
          {visible.map((item) => {
            const elapsed = item.status === "IN_PROGRESS" ? timeInStage(enteredAtById[item.id]) : null;
            return (
              <Card as="li" key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/recrutamento/vagas/${jobId}/candidaturas/${item.id}${reportQuery}`}
                    className={cn("break-words rounded-sm text-h3 text-ink-900 hover:underline", focusRing)}
                  >
                    {item.candidateName}
                  </Link>
                  <p className="text-body text-ink-600">
                    {STAGE_LABEL[item.currentStageType] ?? item.currentStageType}
                    {elapsed && ` · há ${elapsed} na etapa`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {item.matchScore !== null && <Badge variant={matchVariant(item.matchScore)}>{item.matchScore}% match</Badge>}
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
    </>
  );
}
