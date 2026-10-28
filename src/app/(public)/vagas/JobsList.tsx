"use client";

import { Reveal } from "@/components/motion/Reveal";
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
  SearchInput,
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

  // Busca enquanto digita: o rascunho vai para a URL 350ms depois da última tecla.
  const [qDraft, setQDraft] = useState(searchParams.get("q") ?? "");
  const [techDraft, setTechDraft] = useState(searchParams.get("technology") ?? "");
  const urlQ = searchParams.get("q") ?? "";
  const urlTech = searchParams.get("technology") ?? "";
  // A URL mudou por fora (voltar, limpar filtros): o rascunho acompanha. Quando foi o próprio
  // rascunho que a mudou, ele já bate (ignorando espaços nas pontas) e não é sobrescrito.
  useEffect(() => {
    setQDraft((draft) => (draft.trim() === urlQ ? draft : urlQ));
    setTechDraft((draft) => (draft.trim() === urlTech ? draft : urlTech));
  }, [urlQ, urlTech]);

  // A URL é a única fonte da verdade do recorte: o efeito depende só da query string, então
  // reescrever a URL com o mesmo conteúdo não refaz a busca (sem laço — risco da spec 004).
  useEffect(() => {
    let cancelled = false;
    // Mantém os resultados anteriores na tela enquanto a nova busca chega: sem piscar o
    // esqueleto a cada tecla.
    setLoading(true);
    setFailed(false);
    apiFetch<JobListResponse>(`/api/jobs?${queryString}`).then((result) => {
      if (cancelled) return;
      setLoading(false);
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

  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (qDraft.trim() === urlQ && techDraft.trim() === urlTech) return;
    const timer = setTimeout(() => updateQuery({ q: qDraft, technology: techDraft }), 350);
    return () => clearTimeout(timer);
  }, [qDraft, techDraft, urlQ, urlTech, updateQuery]);

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
    : data === null || loading
      ? "Buscando vagas…"
      : `${data.total} ${data.total === 1 ? "vaga ativa" : "vagas ativas"}${hasFilters ? " com os filtros aplicados" : ""}.`;

  return (
    <>
      <PageHeader title="Vagas abertas" subtitle={<span aria-live="polite">{subtitle}</span>} />

      <form
        role="search"
        aria-label="Buscar vagas"
        onSubmit={(e) => {
          e.preventDefault();
          updateQuery({ q: qDraft, technology: techDraft });
        }}
        className="mb-6 grid gap-3 rounded-card border border-brand-100 bg-surface p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-end sm:p-6"
      >
        <Field id="busca-q" label="Cargo ou palavra-chave">
          <SearchInput value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="Ex.: Frontend, Dados…" />
        </Field>
        <Field id="busca-tecnologia" label="Tecnologia">
          <SearchInput value={techDraft} onChange={(e) => setTechDraft(e.target.value)} placeholder="Ex.: React, Python" />
        </Field>
        {/* Enter ainda funciona: envia na hora, sem esperar a pausa na digitação. */}
        <button type="submit" className="sr-only">
          Buscar
        </button>
      </form>

      <WithSidebar
        sidebar={
          <SidebarFilters
            title="Refinar"
            footer={
              hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={cn("inline-flex items-center gap-1.5 rounded-full text-body font-semibold text-primary-700 hover:text-brand-900", focusRing)}
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="m4 4 8 8M12 4l-8 8" />
                  </svg>
                  Limpar filtros
                </button>
              ) : undefined
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
          <div className={cn("space-y-6 transition-opacity duration-200", loading && "opacity-60")} aria-busy={loading}>
            <Reveal as="ul" onScroll={false} stagger={0.06} className="space-y-4">
              {data.items.map((job) => {
                const match = matchStateFor(job, viewer);
                return (
                  <Card as="li" key={job.id} data-reveal className="relative p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-600/40 hover:shadow-popover sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h2 className="font-display text-[19px] font-semibold leading-7">
                          <Link
                            href={`/vagas/${job.id}`}
                            className={cn("break-words rounded-sm text-brand-900 after:absolute after:inset-0 hover:text-primary-700", focusRing)}
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
                      <div className="relative z-10 mt-3">
                        <MatchBadge match={match} />
                      </div>
                    )}
                  </Card>
                );
              })}
            </Reveal>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={hrefForPage} />
          </div>
        )}
      </WithSidebar>
    </>
  );
}
