"use client";

import { useState } from "react";
import Link from "next/link";

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

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  WITHDRAWN: "Desistiu",
};

export function CandidateSearch() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CandidateSearchItem[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    // Resposta de erro não traz `items`: sem esta guarda, `items.length` abaixo
    // lança TypeError e derruba a página inteira.
    const res = await fetch(`/api/recruiter/candidates?q=${encodeURIComponent(query)}`);
    const data = res.ok ? await res.json().catch(() => null) : null;
    setItems(Array.isArray(data?.items) ? data.items : []);
    setSearching(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold sm:text-2xl">Candidatos</h1>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, e-mail ou tecnologia"
          className="min-w-0 flex-1 basis-48 rounded border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={searching}
          className="shrink-0 rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Buscar
        </button>
      </form>

      {items !== null && items.length === 0 && (
        <p className="text-sm text-slate-500">Nenhum candidato encontrado para essa busca.</p>
      )}

      <ul className="space-y-3">
        {items?.map((candidate) => (
          <li key={candidate.candidateId} className="rounded border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-medium">{candidate.name}</p>
                <p className="break-all text-sm text-slate-500 sm:break-words">{candidate.email}</p>
              </div>
              <Link href="/recrutamento/vagas" className="shrink-0 text-sm underline">
                Convidar para nova vaga
              </Link>
            </div>
            <ul className="mt-2 divide-y divide-slate-100">
              {candidate.applications.map((application) => (
                <li key={application.jobId} className="flex justify-between gap-2 py-1.5 text-sm text-slate-600">
                  <span className="min-w-0 break-words">{application.jobTitle}</span>
                  <span className="shrink-0 text-right">
                    {STATUS_LABEL[application.status]}
                    {application.score !== null && ` · ${application.score}%`}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
