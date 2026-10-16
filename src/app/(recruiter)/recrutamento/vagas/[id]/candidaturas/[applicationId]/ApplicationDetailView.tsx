"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_LABEL } from "@/lib/processStages";

interface EvaluationView {
  type: string;
  score: number;
  justification: { matched?: string[]; missing?: string[] } | null;
}

interface ApplicationDetailData {
  id: string;
  candidate: { name: string; email: string };
  job: { id: string; title: string };
  currentStage: { type: string; order: number };
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  evaluations: EvaluationView[];
  externalAccounts: Array<{ provider: string; status: string }>;
  resume: { id: string; originalFilename: string } | null;
  codeTest: { status: "NOT_AVAILABLE_YET" };
}

const EVALUATION_LABEL: Record<string, string> = { RESUME_MATCH: "Compatibilidade geral", GITHUB_ANALYSIS: "Análise de GitHub" };

export function ApplicationDetailView({ applicationId }: { jobId: string; applicationId: string }) {
  const router = useRouter();
  const [data, setData] = useState<ApplicationDetailData | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/recruiter/applications/${applicationId}`)
      .then((res) => res.json())
      .then(setData);
  }, [applicationId]);

  async function handleDecision(decision: "ADVANCE" | "REJECT") {
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/recruiter/applications/${applicationId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage(decision === "ADVANCE" ? "Candidato avançado." : "Candidato reprovado.");
      router.refresh();
      const updated = await fetch(`/api/recruiter/applications/${applicationId}`).then((r) => r.json());
      setData(updated);
    } else {
      const body = await res.json().catch(() => null);
      setMessage(body?.error?.message ?? "Não foi possível registrar a decisão.");
    }
  }

  if (!data) return <p>Carregando…</p>;

  const mainEvaluation = data.evaluations.find((e) => e.type === "RESUME_MATCH");
  const otherEvaluations = data.evaluations.filter((e) => e.type !== "RESUME_MATCH");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{data.candidate.name}</h1>
        <p className="text-sm text-slate-600">
          {data.candidate.email} · {data.job.title}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4">
          {mainEvaluation && (
            <div>
              <p className="text-3xl font-semibold">{mainEvaluation.score}%</p>
              <p className="text-sm text-slate-500">compatibilidade geral</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Encontradas</p>
                  <p className="text-sm text-slate-600">{mainEvaluation.justification?.matched?.join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Faltando</p>
                  <p className="text-sm text-slate-600">{mainEvaluation.justification?.missing?.join(", ") || "—"}</p>
                </div>
              </div>
            </div>
          )}

          {otherEvaluations.map((evaluation) => (
            <div key={evaluation.type} className="rounded border border-slate-200 p-3">
              <p className="text-sm font-medium">
                {EVALUATION_LABEL[evaluation.type] ?? evaluation.type}: {evaluation.score}%
              </p>
            </div>
          ))}

          <p className="text-sm text-slate-600">
            Etapa atual: {STAGE_LABEL[data.currentStage.type] ?? data.currentStage.type}
          </p>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium uppercase text-slate-500">Currículo</h2>
            {data.resume ? (
              <a href={`/api/resumes/${data.resume.id}/download`} className="text-sm underline">
                {data.resume.originalFilename}
              </a>
            ) : (
              <p className="text-sm text-slate-500">Nenhum currículo.</p>
            )}
          </div>

          <div>
            <h2 className="text-sm font-medium uppercase text-slate-500">Contas externas</h2>
            {data.externalAccounts.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma conta conectada.</p>
            ) : (
              <ul className="text-sm text-slate-600">
                {data.externalAccounts.map((account) => (
                  <li key={account.provider}>
                    {account.provider}: {account.status === "UNAVAILABLE" ? "indisponível" : account.status}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-sm font-medium uppercase text-slate-500">Teste de código</h2>
            <p className="text-sm text-slate-500">Ainda não disponível nesta versão.</p>
          </div>
        </section>
      </div>

      {data.status === "IN_PROGRESS" && (
        <div className="flex gap-3 border-t border-slate-200 pt-6">
          <button
            onClick={() => handleDecision("ADVANCE")}
            disabled={saving}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            Avançar
          </button>
          <button
            onClick={() => handleDecision("REJECT")}
            disabled={saving}
            className="rounded border border-slate-300 px-4 py-2 disabled:opacity-50"
          >
            Reprovar
          </button>
        </div>
      )}
      {data.status !== "IN_PROGRESS" && (
        <p className="text-sm text-slate-600 border-t border-slate-200 pt-6">
          Candidatura {data.status === "APPROVED" ? "aprovada" : data.status === "REJECTED" ? "reprovada" : "retirada"}.
        </p>
      )}

      {message && <p className="text-sm text-slate-700">{message}</p>}
    </div>
  );
}
