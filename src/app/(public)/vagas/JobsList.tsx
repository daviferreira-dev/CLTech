"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { SENIORITY_LABEL, WORK_MODE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import { SidebarFilters, WithSidebar } from "@/components/layout/SidebarFilters";
import {
  Button,
  Card,
  CardListSkeleton,
  ChipList,
  EmptyState,
  ErrorState,
  Field,
  Input,
  MatchBadge,
  Pagination,
  Select,
  focusRing,
  type MatchState,
} from "@/components/ui";

type MatchScore = { status: "CALCULATED"; value: number } | { status: "NEEDS_RESUME" };

interface JobListItem {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  seniority: "INTERN" | "JUNIOR" | "MID" | "SENIOR";
  technologies: string[];
  matchScore?: MatchScore;
}

interface JobListResponse {
  items: JobListItem[];
  page: number;
  pageSize: number;
  total: number;
}

// Exatamente os parâmetros de `jobListQuerySchema` — nenhum outro (spec 004 US1.2).
const FILTER_KEYS = ["q", "technology", "workMode", "seniority"] as const;

type Viewer = "candidate" | "staff" | "visitor";

/**
 * FR-109: o backend devolve CALCULATED, NEEDS_RESUME ou nada. Para o candidato, "nada"
 * significa que o JobMatch ainda não foi gerado (recalculo é fire-and-forget) — calculando.
 */
function matchStateFor(job: JobListItem, viewer: Viewer): MatchState | null {
  if (viewer !== "candidate") return null;
  return job.matchScore ?? { status: "NOT_CALCULATED" };
}

export function JobsList({ viewer }: { viewer: Viewer }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const [data, setData] = useState<JobListResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Campos de texto só vão para a URL ao enviar a busca; até lá, ficam no rascunho local.
  const [qDraft, setQDraft] = useState(searchParams.get("q") ?? "");
  const [techDraft, setTechDraft] = useState(searchParams.get("technology") ?? "");
  useEffect(() => {
    setQDraft(searchParams.get("q") ?? "");
    setTechDraft(searchParams.get("technology") ?? "");
  }, [searchParams]);

  // A URL é a única fonte da verdade do recorte: o efeito depende só da query string, então
  // reescrever a URL com o mesmo conteúdo não refaz a busca (sem laço — risco da spec 004).
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    apiFetch<JobListResponse>(`/api/jobs?${queryString}`).then((result) => {
      if (cancelled) return;
      // Uma resposta de erro não tem `items`: sem esta guarda o `.length` derrubava a página.
      if (result.ok && Array.isArray(result.data?.items)) {
        setData(result.data);
        return;
      }
      setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [queryString, reloadKey]);

  const updateQuery = useCallback(
    (changes: Partial<Record<(typeof FILTER_KEYS)[number], string>>) => {
      const next = new URLSearchParams(queryString);
      for (const [key, value] of Object.entries(changes)) {
        const trimmed = value?.trim();
        if (trimmed) next.set(key, trimmed);
        else next.delete(key);
      }
      next.delete("page"); // novo recorte começa da primeira página
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, queryString, router],
  );

  const hrefForPage = useCallback(
    (page: number) => {
      const next = new URLSearchParams(queryString);
      if (page <= 1) next.delete("page");
      else next.set("page", String(page));
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, queryString],
  );

  const hasFilters = FILTER_KEYS.some((key) => searchParams.get(key));
  const clearFilters = () => router.replace(pathname, { scroll: false });

  const subtitle = failed
    ? "Encontre a vaga certa e acompanhe seu processo pela plataforma."
    : data === null
      ? "Carregando vagas…"
      : `${data.total} ${data.total === 1 ? "vaga ativa" : "vagas ativas"}${hasFilters ? " com os filtros aplicados" : ""}.`;

  return (
    <>
      <PageHeader title="Oportunidades Abertas na CLTech" subtitle={<span aria-live="polite">{subtitle}</span>} />

      <form
        role="search"
        aria-label="Buscar vagas"
        onSubmit={(e) => {
          e.preventDefault();
          updateQuery({ q: qDraft, technology: techDraft });
        }}
        className="mb-6 grid gap-3 rounded-card border border-brand-100 bg-surface p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end sm:p-6"
      >
        <Field id="busca-q" label="Cargo ou palavra-chave">
          <Input type="search" value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Ex.: Frontend, Dados…" />
        </Field>
        <Field id="busca-tecnologia" label="Tecnologia">
          <Input value={techDraft} onChange={(e) => setTechDraft(e.target.value)} placeholder="Ex.: React" />
        </Field>
        <Button type="submit">Buscar</Button>
      </form>

      <WithSidebar
        sidebar={
          <SidebarFilters
            title="Refinar"
            footer={
              <Button variant="ghost" size="sm" onClick={clearFilters} disabled={!hasFilters}>
                Limpar filtros
              </Button>
            }
          >
            <Field id="filtro-modalidade" label="Modalidade">
              <Select value={searchParams.get("workMode") ?? ""} onChange={(e) => updateQuery({ workMode: e.target.value })}>
                <option value="">Todas as modalidades</option>
                <option value="REMOTE">Remoto</option>
                <option value="HYBRID">Híbrido</option>
                <option value="ONSITE">Presencial</option>
              </Select>
            </Field>
            <Field id="filtro-senioridade" label="Senioridade">
              <Select value={searchParams.get("seniority") ?? ""} onChange={(e) => updateQuery({ seniority: e.target.value })}>
                <option value="">Todas as senioridades</option>
                <option value="INTERN">Estágio</option>
                <option value="JUNIOR">Júnior</option>
                <option value="MID">Pleno</option>
                <option value="SENIOR">Sênior</option>
              </Select>
            </Field>
          </SidebarFilters>
        }
      >
        {data === null && !failed && <CardListSkeleton label="Carregando vagas…" />}

        {failed && (
          <ErrorState
            title="Não foi possível carregar as vagas."
            description="Pode ser uma instabilidade momentânea. Seus filtros foram mantidos."
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        )}

        {data && data.items.length === 0 && (
          <EmptyState
            title={hasFilters ? "Nenhuma vaga encontrada com esses filtros." : "Nenhuma vaga aberta no momento."}
            description={hasFilters ? "Tente ampliar a busca ou remover algum filtro." : "Volte em breve — novas vagas são publicadas com frequência."}
            action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button> : undefined}
          />
        )}

        {data && data.items.length > 0 && (
          <div className="space-y-6">
            <ul className="space-y-4">
              {data.items.map((job) => {
                const match = matchStateFor(job, viewer);
                return (
                  <Card as="li" key={job.id} className="p-4 transition-colors hover:border-ink-400 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h2 className="text-h3">
                          <Link
                            href={`/vagas/${job.id}`}
                            className={cn("break-words rounded-sm text-ink-900 hover:underline", focusRing)}
                          >
                            {job.title}
                          </Link>
                        </h2>
                        <p className="break-words text-body text-ink-600">
                          {job.company} · {job.location} · {WORK_MODE_LABEL[job.workMode]} · {SENIORITY_LABEL[job.seniority]}
                        </p>
                      </div>
                      {match && match.status !== "NEEDS_RESUME" && <MatchBadge match={match} />}
                    </div>
                    <div className="mt-3">
                      <ChipList items={job.technologies} label={`Tecnologias de ${job.title}`} />
                    </div>
                    {match?.status === "NEEDS_RESUME" && (
                      <div className="mt-3">
                        <MatchBadge match={match} />
                      </div>
                    )}
                  </Card>
                );
              })}
            </ul>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={hrefForPage} />
          </div>
        )}
      </WithSidebar>
    </>
  );
}
