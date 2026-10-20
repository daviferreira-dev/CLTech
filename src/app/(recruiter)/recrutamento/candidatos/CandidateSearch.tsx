"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { APPLICATION_STATUS_BADGE, RECRUITER_APPLICATION_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardListSkeleton,
  EmptyState,
  ErrorState,
  Input,
  focusRing,
  matchVariant,
  textLinkClasses,
} from "@/components/ui";

interface CandidateSearchApplication {
  jobId: string;
  jobTitle: string;
  score: number | null;
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
}

interface CandidateSearchItem {
  candidateId: string;
  name: string;
  email: string;
  applications: CandidateSearchApplication[];
}

export function CandidateSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Os critérios vivem na URL e sobrevivem ao voltar do navegador (spec 004 US6.1).
  const q = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(q);
  const [items, setItems] = useState<CandidateSearchItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => setQuery(q), [q]);

  const runSearch = useCallback(async (term: string) => {
    setSearching(true);
    setFailed(false);
    const result = await apiFetch<{ items: CandidateSearchItem[] }>(`/api/recruiter/candidates?q=${encodeURIComponent(term)}`);
    // Resposta de erro não traz `items`: sem esta guarda, `items.length` derruba a página.
    if (result.ok && Array.isArray(result.data?.items)) setItems(result.data.items);
    else if (result.status !== 401) {
      setItems(null);
      setFailed(true);
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    if (q.trim()) runSearch(q);
    else setItems(null);
  }, [q, runSearch]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    if (term === q) {
      runSearch(term); // mesma URL: o efeito não dispararia de novo
      return;
    }
    router.push(`${pathname}?q=${encodeURIComponent(term)}`, { scroll: false });
  }

  return (
    <>
      <PageHeader title="Candidatos" subtitle="Busque entre todas as pessoas que já se candidataram a alguma vaga." />

      <form onSubmit={handleSearch} role="search" className="mb-6 flex flex-col gap-3 rounded-card border border-brand-100 bg-surface p-4 sm:flex-row sm:p-6">
        <label htmlFor="busca-candidatos" className="sr-only">
          Buscar candidatos
        </label>
        <Input
          id="busca-candidatos"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, e-mail ou tecnologia"
          className="sm:flex-1"
        />
        <Button type="submit" loading={searching}>
          Buscar
        </Button>
      </form>

      {searching && items === null && <CardListSkeleton count={2} label="Buscando candidatos…" />}
      {failed && <ErrorState title="Não foi possível buscar candidatos." onRetry={() => runSearch(q || query)} />}

      {!q && !searching && !failed && (
        <EmptyState title="Comece pela busca." description="Digite um nome, um e-mail ou uma tecnologia exigida por alguma vaga." />
      )}

      {items !== null && items.length === 0 && (
        // US6.3: sugere afrouxar os critérios sem apagar o que foi digitado.
        <EmptyState
          title="Nenhum candidato encontrado para essa busca."
          description="Tente um termo mais curto — parte do nome, só o domínio do e-mail ou uma única tecnologia."
        />
      )}

      {items && items.length > 0 && (
        <ul className="space-y-4" aria-busy={searching || undefined}>
          {items.map((candidate) => (
            <Card as="li" key={candidate.candidateId} className="p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={candidate.name} />
                  <div className="min-w-0">
                    <p className="break-words text-h3 text-ink-900">{candidate.name}</p>
                    <p className="break-all text-body text-ink-600 sm:break-words">{candidate.email}</p>
                  </div>
                </div>
                <Link href="/recrutamento/vagas" className={cn(textLinkClasses, "self-start text-body sm:shrink-0")}>
                  Convidar para nova vaga
                </Link>
              </div>
              <ul className="mt-4 divide-y divide-brand-100 rounded-card border border-brand-100">
                {candidate.applications.map((application) => (
                  <li key={application.jobId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      href={`/recrutamento/candidatos/abrir?candidato=${candidate.candidateId}&vaga=${application.jobId}&q=${encodeURIComponent(q)}`}
                      className={cn("min-w-0 break-words rounded-sm text-body font-medium text-ink-900 hover:underline", focusRing)}
                    >
                      {application.jobTitle}
                    </Link>
                    <span className="flex shrink-0 flex-wrap items-center gap-2">
                      {application.score !== null && <Badge variant={matchVariant(application.score)}>{application.score}%</Badge>}
                      <Badge variant={APPLICATION_STATUS_BADGE[application.status]}>
                        {RECRUITER_APPLICATION_STATUS_LABEL[application.status]}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
