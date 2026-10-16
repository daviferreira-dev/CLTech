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
    const res = await fetch(`/api/recruiter/candidates?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setItems(data.items);
    setSearching(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Candidatos</h1>

      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, e-mail ou tecnologia"
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
        <button type="submit" disabled={searching} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
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
              <div>
                <p className="font-medium">{candidate.name}</p>
                <p className="text-sm text-slate-500">{candidate.email}</p>
              </div>
              <Link href="/recrutamento/vagas" className="shrink-0 text-sm underline">
                Convidar para nova vaga
              </Link>
            </div>
            <ul className="mt-2 divide-y divide-slate-100">
              {candidate.applications.map((application) => (
                <li key={application.jobId} className="flex justify-between py-1.5 text-sm text-slate-600">
                  <span>{application.jobTitle}</span>
                  <span>
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
