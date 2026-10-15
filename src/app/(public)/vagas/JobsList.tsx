"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface JobListItem {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: "REMOTE" | "HYBRID" | "ONSITE";
  seniority: "INTERN" | "JUNIOR" | "MID" | "SENIOR";
  technologies: string[];
}

const WORK_MODE_LABEL: Record<string, string> = { REMOTE: "Remoto", HYBRID: "Híbrido", ONSITE: "Presencial" };
const SENIORITY_LABEL: Record<string, string> = {
  INTERN: "Estágio",
  JUNIOR: "Júnior",
  MID: "Pleno",
  SENIOR: "Sênior",
};

export function JobsList() {
  const [items, setItems] = useState<JobListItem[] | null>(null);
  const [workMode, setWorkMode] = useState("");
  const [seniority, setSeniority] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (workMode) params.set("workMode", workMode);
    if (seniority) params.set("seniority", seniority);

    fetch(`/api/jobs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items));
  }, [workMode, seniority]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select
          value={workMode}
          onChange={(e) => setWorkMode(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        >
          <option value="">Todas as modalidades</option>
          <option value="REMOTE">Remoto</option>
          <option value="HYBRID">Híbrido</option>
          <option value="ONSITE">Presencial</option>
        </select>
        <select
          value={seniority}
          onChange={(e) => setSeniority(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        >
          <option value="">Todas as senioridades</option>
          <option value="INTERN">Estágio</option>
          <option value="JUNIOR">Júnior</option>
          <option value="MID">Pleno</option>
          <option value="SENIOR">Sênior</option>
        </select>
      </div>

      {items === null && <p>Carregando…</p>}
      {items !== null && items.length === 0 && (
        <p className="text-slate-500">Nenhuma vaga encontrada com esses filtros. Tente ampliar a busca.</p>
      )}

      <ul className="space-y-4">
        {items?.map((job) => (
          <li key={job.id} className="rounded border border-slate-200 p-4">
            <Link href={`/vagas/${job.id}`} className="text-lg font-semibold hover:underline">
              {job.title}
            </Link>
            <p className="text-sm text-slate-600">
              {job.company} · {job.location} · {WORK_MODE_LABEL[job.workMode]} · {SENIORITY_LABEL[job.seniority]}
            </p>
            <p className="mt-1 text-sm text-slate-500">{job.technologies.join(", ")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
