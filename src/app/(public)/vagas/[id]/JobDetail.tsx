"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STAGE_LABEL } from "@/lib/processStages";
import { apiFetch, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { SENIORITY_LABEL, jobPlace } from "@/lib/labels";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Chip,
  EmptyState,
  ErrorState,
  MatchBadge,
  Notice,
  Skeleton,
  StageTrail,
  textLinkClasses,
} from "@/components/ui";

type MatchScore =
  | { status: "CALCULATED"; value: number; matched?: string[]; missing?: string[] }
  | { status: "NEEDS_RESUME" };

interface JobDetailView {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  seniority: "INTERN" | "JUNIOR" | "MID" | "SENIOR";
  minimumRequirements: string;
  technologies: string[];
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  stages: Array<{ type: string; order: number }>;
  matchScore?: MatchScore;
  hasApplied?: boolean;
}

type Viewer = "candidate" | "staff" | "visitor";

/**
 * Estado da ação de candidatar-se. Cada código de recusa da API vira um próximo passo
 * (spec 004 US2, FR-103) — a ação nunca some, só muda de estado (spec 003 US4.3).
 */
type ApplyState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "resumeRequired" }
  | { kind: "alreadyApplied" }
  | { kind: "notOpen" }
  | { kind: "failed"; message: string };

export function JobDetail({ jobId, viewer }: { jobId: string; viewer: Viewer }) {
  const router = useRouter();
  const [job, setJob] = useState<JobDetailView | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "notFound" | "failed">("loading");
  const [apply, setApply] = useState<ApplyState>({ kind: "idle" });

  const load = useCallback(async () => {
    setLoadState("loading");
    const result = await apiFetch<JobDetailView>(`/api/jobs/${jobId}`);
    if (result.ok) {
      setJob(result.data);
      // Já candidatado: mostra o acompanhamento em vez do botão (inclusive ao voltar pelo
      // histórico, quando o Next reaproveita a página em cache).
      if (result.data.hasApplied) setApply({ kind: "alreadyApplied" });
      setLoadState("ready");
    } else if (result.status === 404) {
      setLoadState("notFound");
    } else {
      setLoadState("failed");
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApply() {
    // FR-023 / spec 004 US2.1: visitante vai ao login e volta para esta mesma vaga.
    if (viewer === "visitor") {
      window.location.href = `/entrar?callbackUrl=${encodeURIComponent(`/vagas/${jobId}`)}`;
      return;
    }
    // FR-104: sem duplo envio — o botão já está desabilitado, isto cobre cliques em sequência.
    if (apply.kind === "sending") return;

    setApply({ kind: "sending" });
    const result = await apiFetch<{ applicationId: string }>(`/api/jobs/${jobId}/apply`, { method: "POST" });

    if (result.ok) {
      // US2.5: leva a /candidaturas com a nova candidatura identificável.
      router.push(`/candidaturas?nova=${encodeURIComponent(result.data.applicationId)}`);
      return;
    }
    if (result.networkError) {
      setApply({ kind: "failed", message: NETWORK_ERROR_MESSAGE });
      return;
    }
    switch (result.error?.code) {
      case "UNAUTHENTICATED":
        return; // apiFetch já está levando ao login
      case "RESUME_REQUIRED":
        setApply({ kind: "resumeRequired" });
        return;
      case "ALREADY_APPLIED":
        setApply({ kind: "alreadyApplied" });
        return;
      case "JOB_NOT_OPEN":
        setApply({ kind: "notOpen" });
        return;
      default:
        setApply({ kind: "failed", message: result.error?.message ?? "Não foi possível concluir a candidatura." });
    }
  }

  const breadcrumb = <Breadcrumb items={[{ label: "Vagas", href: "/vagas" }, { label: job?.title ?? "Detalhe da vaga" }]} />;

  if (loadState === "loading") {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <span className="sr-only">Carregando vaga…</span>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-48 w-full rounded-card" />
      </div>
    );
  }

  if (loadState === "notFound") {
    return (
      <EmptyState
        title="Vaga não encontrada"
        description="Ela pode ter sido encerrada ou o endereço está incorreto."
        action={<ButtonLink href="/vagas">Ver vagas abertas</ButtonLink>}
      />
    );
  }

  if (loadState === "failed" || !job) {
    return (
      <ErrorState
        title="Não conseguimos abrir esta vaga agora."
        onRetry={load}
        action={
          <ButtonLink href="/vagas" variant="ghost">
            Voltar às vagas
          </ButtonLink>
        }
      />
    );
  }

  const calculated = job.matchScore?.status === "CALCULATED" ? job.matchScore : null;
  const matched = new Set(calculated?.matched ?? []);
  const profileHref = `/perfil?next=${encodeURIComponent(`/vagas/${jobId}`)}`;
  const matchState =
    viewer !== "candidate"
      ? null
      : job.matchScore
        ? job.matchScore
        : ({ status: "NOT_CALCULATED" } as const);

  return (
    <>
      <PageHeader
        breadcrumb={breadcrumb}
        title={job.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{job.company}</span>
            <span aria-hidden="true">·</span>
            <span>{jobPlace(job.location, job.workMode)}</span>
            <span aria-hidden="true">·</span>
            <span>{SENIORITY_LABEL[job.seniority]}</span>
          </span>
        }
        actions={matchState && matchState.status !== "NEEDS_RESUME" ? <MatchBadge match={matchState} /> : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card as="section" aria-labelledby="sobre-vaga">
            <CardHeader titleId="sobre-vaga" title="Sobre a vaga" />
            <CardBody className="space-y-4">
              <p className="whitespace-pre-line break-words text-body text-fg">{job.description}</p>
              <div className="space-y-1">
                <h3 className="text-label text-fg-muted">Requisitos mínimos</h3>
                <p className="whitespace-pre-line break-words text-body text-fg">{job.minimumRequirements}</p>
              </div>
            </CardBody>
          </Card>

          <Card as="section" aria-labelledby="tecnologias-vaga">
            <CardHeader
              titleId="tecnologias-vaga"
              title="Tecnologias"
              description={calculated ? "Comparadas com o seu currículo e GitHub." : undefined}
            />
            <CardBody className="space-y-4">
              {calculated ? (
                <>
                  <p className="text-body font-medium text-fg">Sua compatibilidade: {calculated.value}%</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <h3 className="text-label text-fg-muted">Encontradas no seu perfil</h3>
                      <TechList items={calculated.matched ?? []} tone="found" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-label text-fg-muted">Ainda faltando</h3>
                      <TechList items={calculated.missing ?? []} tone="missing" />
                    </div>
                  </div>
                </>
              ) : (
                <TechList items={job.technologies} tone="default" />
              )}
              {matchState?.status === "NEEDS_RESUME" && (
                // Uma ação primária por tela (Candidatar-se, ao lado): aqui o caminho para o perfil é só um link.
                <p className="text-body text-fg-muted">
                  <Link href={profileHref} className={textLinkClasses}>
                    Envie seu currículo
                  </Link>{" "}
                  para ver sua compatibilidade com esta vaga.
                </p>
              )}
              {calculated && matched.size === 0 && (calculated.missing ?? []).length === 0 && (
                <p className="text-body text-fg-muted">Esta vaga não lista tecnologias.</p>
              )}
            </CardBody>
          </Card>

          <Card as="section" aria-labelledby="etapas-vaga">
            <CardHeader titleId="etapas-vaga" title="Etapas do processo" />
            <CardBody>
              {job.stages.length > 0 ? (
                <StageTrail stages={job.stages.map((s) => ({ type: s.type, label: STAGE_LABEL[s.type] ?? s.type }))} />
              ) : (
                <p className="text-body text-fg-muted">O processo seletivo ainda não foi configurado.</p>
              )}
            </CardBody>
          </Card>
        </div>

        {/*
          Uma única instância da ação: barra fixa no rodapé em mobile (spec 003 US4.2 — o
          padding inferior da página evita cobrir conteúdo) e cartão fixo na coluna no desktop.
          Duas cópias (uma escondida) quebrariam leitores de tela e o strict mode dos E2E.
        */}
        <aside aria-label="Candidatura" className="min-w-0">
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 py-3 shadow-header lg:sticky lg:inset-auto lg:top-24 lg:z-auto lg:rounded-card lg:border lg:p-6 lg:shadow-none">
            <ApplyAction
              state={apply}
              viewer={viewer}
              jobOpen={job.status === "PUBLISHED"}
              onApply={handleApply}
              profileHref={profileHref}
            />
          </div>
        </aside>
      </div>
    </>
  );
}

function TechList({ items, tone }: { items: string[]; tone: "found" | "missing" | "default" }) {
  if (items.length === 0) return <p className="text-body text-fg-muted">—</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((tech) => (
        <li key={tech}>
          <Chip tone={tone}>
            {tech}
            {tone === "missing" && <span className="sr-only"> (não encontrada)</span>}
          </Chip>
        </li>
      ))}
    </ul>
  );
}

function ApplyAction({
  state,
  viewer,
  jobOpen,
  onApply,
  profileHref,
}: {
  state: ApplyState;
  viewer: Viewer;
  jobOpen: boolean;
  onApply: () => void;
  profileHref: string;
}) {
  const full = "w-full sm:w-auto lg:w-full";

  if (viewer === "staff") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
        <Button className={full} disabled>
          Candidatar-se
        </Button>
        <p className="text-body text-fg-muted">Somente candidatos podem se candidatar a vagas.</p>
      </div>
    );
  }

  if (!jobOpen || state.kind === "notOpen") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch">
        <p role="status" className="text-body text-fg">
          Esta vaga não está mais aberta para candidaturas.
        </p>
        <ButtonLink href="/vagas" variant="secondary" className={full}>
          Voltar às vagas
        </ButtonLink>
      </div>
    );
  }

  if (state.kind === "alreadyApplied") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch">
        <Badge variant="success">Candidatura enviada</Badge>
        <ButtonLink href="/candidaturas" variant="secondary" className={full}>
          Acompanhar candidatura
        </ButtonLink>
      </div>
    );
  }

  if (state.kind === "resumeRequired") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-stretch">
        <p role="alert" className="text-body text-fg">
          Complete seu perfil com um currículo antes de se candidatar.
        </p>
        <ButtonLink href={profileHref} className={full}>
          Enviar currículo
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={onApply} loading={state.kind === "sending"} className={full}>
        {state.kind === "sending" ? "Enviando…" : "Candidatar-se"}
      </Button>
      {viewer === "visitor" && (
        <p className="hidden text-body text-fg-muted lg:block">Você vai entrar ou criar uma conta e voltar para esta vaga.</p>
      )}
      {state.kind === "failed" && (
        <p role="alert" className="text-body text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}
