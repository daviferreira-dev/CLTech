  import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/server/auth/config";
import { listMyApplications } from "@/server/applications/list";

const STAGE_LABEL: Record<string, string> = {
  RESUME_ANALYSIS: "Análise de currículo",
  CODE_TEST: "Teste de código",
  GITHUB_ANALYSIS: "Análise de GitHub",
  HR_INTERVIEW: "Entrevista com RH",
  TECH_INTERVIEW: "Entrevista técnica",
  FINAL_OFFER: "Proposta final",
};

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  APPROVED: "Aprovado",
  REJECTED: "Não aprovado",
  WITHDRAWN: "Retirada",
};

export default async function MyApplicationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/entrar?callbackUrl=/candidaturas");
  if (session.user.role !== "CANDIDATE") redirect("/recrutamento");

  const applications = await listMyApplications(session.user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <h1 className="text-2xl font-semibold">Minhas Candidaturas</h1>

      {applications.length === 0 ? (
        <p className="text-sm text-slate-500">
          Você ainda não se candidatou a nenhuma vaga.{" "}
          <Link href="/vagas" className="underline">
            Explorar vagas abertas
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {applications.map((app) => (
            <li
              key={app.applicationId}
              className="rounded border border-slate-200 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{app.job.title}</span>
                <span className="text-sm text-slate-500">{STATUS_LABEL[app.status]}</span>
              </div>
              <p className="text-sm text-slate-600">{app.job.company}</p>
              <p className="text-sm text-slate-500">
                Candidatura em {new Date(app.appliedAt).toLocaleDateString("pt-BR")} · Etapa
                atual: {STAGE_LABEL[app.currentStage.type]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
