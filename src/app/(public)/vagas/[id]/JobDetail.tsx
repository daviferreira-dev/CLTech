"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { STAGE_LABEL } from "@/lib/processStages";

type MatchScore =
  | { status: "CALCULATED"; value: number; matched?: string[]; missing?: string[] }
  | { status: "NEEDS_RESUME" };

interface JobDetailView {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  minimumRequirements: string;
  technologies: string[];
  stages: Array<{ type: string; order: number }>;
  matchScore?: MatchScore;
}

export function JobDetail({ jobId }: { jobId: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [job, setJob] = useState<JobDetailView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then((res) => res.json())
      .then(setJob);
  }, [jobId]);

  async function handleApply() {
    // FR-023: visitante deslogado é levado à autenticação e retorna a esta vaga.
    if (status !== "authenticated") {
      window.location.href = `/entrar?callbackUrl=/vagas/${jobId}`;
      return;
    }

    setApplying(true);
    setMessage(null);
    const res = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST" });
    setApplying(false);

    if (res.ok) {
      setMessage("Candidatura registrada com sucesso!");
      router.refresh();
      return;
    }

    const body = await res.json().catch(() => null);
    const code = body?.error?.code;
    if (code === "RESUME_REQUIRED") {
      setMessage("Complete seu perfil com um currículo antes de se candidatar.");
    } else if (code === "ALREADY_APPLIED") {
      setMessage(body.error.message);
    } else {
      setMessage(body?.error?.message ?? "Não foi possível concluir a candidatura.");
    }
  }

  if (!job) return <p>Carregando…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{job.title}</h1>
      <p className="text-slate-600">
        {job.company} · {job.location}
      </p>
      <p>{job.description}</p>
      <p className="text-sm text-slate-500">Requisitos mínimos: {job.minimumRequirements}</p>
      <p className="text-sm text-slate-500">Tecnologias: {job.technologies.join(", ")}</p>

      {job.matchScore?.status === "CALCULATED" && (
        <div className="rounded border border-slate-200 p-4">
          <p className="text-sm font-medium">Sua compatibilidade: {job.matchScore.value}%</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Encontradas no seu perfil</p>
              <p className="text-sm text-slate-600">{job.matchScore.matched?.join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Ainda faltando</p>
              <p className="text-sm text-slate-600">{job.matchScore.missing?.join(", ") || "—"}</p>
            </div>
          </div>
        </div>
      )}
      {job.matchScore?.status === "NEEDS_RESUME" && (
        <p className="text-sm text-slate-500">Complete seu perfil para ver sua compatibilidade com esta vaga.</p>
      )}

      <div>
        <h2 className="font-medium">Etapas do processo</h2>
        <ol className="list-decimal pl-5 text-sm text-slate-600">
          {job.stages.map((stage) => (
            <li key={stage.order}>{STAGE_LABEL[stage.type] ?? stage.type}</li>
          ))}
        </ol>
      </div>

      <button
        onClick={handleApply}
        disabled={applying}
        className="rounded bg-slate-900 px-5 py-2 text-white disabled:opacity-50"
      >
        {applying ? "Enviando…" : "Candidatar-se"}
      </button>

      {message && <p className="text-sm text-slate-700">{message}</p>}
    </div>
  );
}
