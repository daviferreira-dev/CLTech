"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STAGE_LABEL } from "@/lib/processStages";

interface JobApplicationListItem {
  id: string;
  candidateName: string;
  currentStageType: string;
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  matchScore: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
  WITHDRAWN: "Desistiu",
};

export function CandidatesForJobList({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<JobApplicationListItem[] | null>(null);

  useEffect(() => {
    fetch(`/api/recruiter/jobs/${jobId}/applications`)
      .then((res) => res.json())
      .then((data) => setItems(data.items));
  }, [jobId]);

  if (items === null) return <p>Carregando…</p>;
  if (items.length === 0) return <p className="text-sm text-slate-500">Nenhum candidato inscrito ainda.</p>;

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded border border-slate-200 px-4 py-3">
          <Link href={`/recrutamento/vagas/${jobId}/candidaturas/${item.id}`} className="font-medium hover:underline">
            {item.candidateName}
          </Link>
          <p className="text-sm text-slate-500">
            {STAGE_LABEL[item.currentStageType] ?? item.currentStageType} · {STATUS_LABEL[item.status]}
            {item.matchScore !== null && ` · ${item.matchScore}% match`}
          </p>
        </li>
      ))}
    </ul>
  );
}
