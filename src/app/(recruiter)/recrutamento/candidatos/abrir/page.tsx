import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole, RECRUITER_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Ponte da busca de candidatos para o relatório (spec 004 US6.2). A busca devolve
 * candidato + vaga, mas não o id da candidatura, e esta sprint não muda o contrato da API:
 * resolve-se aqui pelo índice único (candidateId, jobId) e redireciona com a origem
 * "busca", para o breadcrumb voltar à busca e não à vaga.
 */

export const metadata = { title: "Abrir candidato" };

export default async function AbrirCandidaturaPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const params = await searchParams;
  await requirePageRole(RECRUITER_ROLES, currentPath("/recrutamento/candidatos/abrir", params));

  const candidateId = first(params.candidato);
  const jobId = first(params.vaga);
  if (!candidateId || !jobId) notFound();

  const application = await prisma.application.findUnique({
    where: { candidateId_jobId: { candidateId, jobId } },
    select: { id: true },
  });
  if (!application) notFound();

  const q = first(params.q);
  redirect(`/recrutamento/vagas/${jobId}/candidaturas/${application.id}?origem=busca${q ? `&q=${encodeURIComponent(q)}` : ""}`);
}
