"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STAGE_LABEL } from "@/lib/processStages";

interface DashboardJob {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  candidatesByStage: Array<{ stageType: string; count: number }>;
}

interface DashboardResult {
  jobs: DashboardJob[];
  funnel: {
    avgTimePerStageHours: Array<{ stageType: string; hours: number }>;
    advanceRatePerStage: Array<{ stageType: string; rate: number }>;
    bottleneckStageType: string | null;
  };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardResult | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  useEffect(() => {
    const url = selectedJobId ? `/api/recruiter/dashboard?jobId=${selectedJobId}` : "/api/recruiter/dashboard";
    fetch(url)
      .then((res) => res.json())
      .then(setData);
  }, [selectedJobId]);

  if (!data) return <p>Carregando…</p>;

  if (data.jobs.length === 0 && !selectedJobId) {
    return (
      <div className="rounded border border-slate-200 p-6 text-center">
        <p className="text-slate-600">Nenhuma vaga ainda.</p>
        <Link href="/recrutamento/vagas/nova" className="mt-2 inline-block text-sm underline">
          Criar a primeira vaga
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Painel de Recrutamento</h1>
        <select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Todas as vagas</option>
          {data.jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.jobs.map((job) => (
          <div key={job.id} className="rounded border border-slate-200 p-4">
            <h2 className="font-medium">
              <Link href={`/recrutamento/vagas/${job.id}/candidaturas`} className="hover:underline">
                {job.title}
              </Link>
            </h2>
            <ul className="mt-2 space-y-1">
              {job.candidatesByStage.map((item) => (
                <li key={item.stageType} className="flex justify-between text-sm text-slate-600">
                  <span>{STAGE_LABEL[item.stageType] ?? item.stageType}</span>
                  <span className="font-medium text-slate-900">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section className="space-y-3 border-t border-slate-200 pt-6">
        <h2 className="text-lg font-semibold">Métricas do funil</h2>
        {data.funnel.avgTimePerStageHours.length === 0 ? (
          <p className="text-sm text-slate-500">Ainda sem movimentação suficiente para calcular métricas.</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.funnel.avgTimePerStageHours.map((item) => {
                const rate = data.funnel.advanceRatePerStage.find((r) => r.stageType === item.stageType);
                return (
                  <div key={item.stageType} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium">{STAGE_LABEL[item.stageType] ?? item.stageType}</p>
                    <p className="text-slate-600">Tempo médio: {item.hours}h</p>
                    {rate && <p className="text-slate-600">Taxa de avanço: {Math.round(rate.rate * 100)}%</p>}
                  </div>
                );
              })}
            </div>
            {data.funnel.bottleneckStageType && (
              <p className="text-sm text-slate-700">
                Gargalo do funil: <span className="font-medium">{STAGE_LABEL[data.funnel.bottleneckStageType]}</span>
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
