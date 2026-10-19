"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface RecruiterJobListItem {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  candidateCount: number;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PUBLISHED: "bg-slate-900 text-white",
  CLOSED: "bg-slate-200 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicada", CLOSED: "Encerrada" };

export function JobsManagerList() {
  const [items, setItems] = useState<RecruiterJobListItem[] | null>(null);

  useEffect(() => {
    // Resposta de erro não traz `items`: sem esta guarda, `items.length` abaixo
    // lança TypeError e derruba a página inteira.
    fetch("/api/recruiter/jobs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold sm:text-2xl">Minhas Vagas</h1>
        <Link href="/recrutamento/vagas/nova" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Criar Vaga
        </Link>
      </div>

      {items === null && <p>Carregando…</p>}
      {items !== null && items.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma vaga ainda. Crie a primeira para começar.</p>
      )}

      <ul className="space-y-3">
        {items?.map((job) => (
          <li key={job.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 px-4 py-3">
            <div className="min-w-0 break-words">
              <Link href={`/recrutamento/vagas/${job.id}`} className="font-medium hover:underline">
                {job.title}
              </Link>
              <p className="text-sm text-slate-500">{job.candidateCount} candidato(s)</p>
            </div>
            <span
              className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[job.status]}`}
            >
              {STATUS_LABEL[job.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
