"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { JOB_STATUS_BADGE, JOB_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, ButtonLink, Card, CardListSkeleton, EmptyState, ErrorState, focusRing } from "@/components/ui";

interface RecruiterJobListItem {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  candidateCount: number;
  createdAt: string;
}

export function JobsManagerList() {
  const [items, setItems] = useState<RecruiterJobListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setItems(null);
    // Resposta de erro não traz `items`: sem esta guarda, `items.length` derruba a página.
    const result = await apiFetch<{ items: RecruiterJobListItem[] }>("/api/recruiter/jobs");
    if (result.ok && Array.isArray(result.data?.items)) setItems(result.data.items);
    else setFailed(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Minhas vagas"
        subtitle={items ? `${items.length} ${items.length === 1 ? "vaga" : "vagas"}` : undefined}
        actions={<ButtonLink href="/recrutamento/vagas/nova">Criar vaga</ButtonLink>}
      />

      {failed && <ErrorState title="Não conseguimos carregar suas vagas." onRetry={load} action={<ButtonLink href="/recrutamento" variant="ghost">Voltar ao painel</ButtonLink>} />}
      {!failed && items === null && <CardListSkeleton label="Carregando vagas…" />}
      {items !== null && items.length === 0 && (
        <EmptyState
          title="Nenhuma vaga ainda."
          description="Crie a primeira para começar."
          action={<ButtonLink href="/recrutamento/vagas/nova">Criar a primeira vaga</ButtonLink>}
        />
      )}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((job) => (
            <Card as="li" key={job.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 text-h3">
                    <Link href={`/recrutamento/vagas/${job.id}`} className={cn("inline-flex min-h-6 items-center break-words rounded-sm text-fg hover:underline", focusRing)}>
                      {job.title}
                    </Link>
                  </h2>
                  <Badge variant={JOB_STATUS_BADGE[job.status]}>{JOB_STATUS_LABEL[job.status]}</Badge>
                </div>
                <p className="text-body text-fg-muted">
                  {job.candidateCount} {job.candidateCount === 1 ? "candidatura" : "candidaturas"} · criada em{" "}
                  {new Date(job.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <ButtonLink href={`/recrutamento/vagas/${job.id}`} variant="secondary" size="sm">
                  {job.status === "DRAFT" ? "Editar e publicar" : "Ver vaga"}
                </ButtonLink>
                {job.status !== "DRAFT" && (
                  <ButtonLink href={`/recrutamento/vagas/${job.id}/candidaturas`} size="sm">
                    Ver candidaturas
                  </ButtonLink>
                )}
              </div>
            </Card>
          ))}
        </ul>
      )}
    </>
  );
}
