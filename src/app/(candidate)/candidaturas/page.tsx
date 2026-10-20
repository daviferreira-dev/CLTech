import Link from "next/link";
import { requirePageRole, CANDIDATE_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { listMyApplications } from "@/server/applications/list";
import { getJobDetail } from "@/server/jobs/detail";
import { STAGE_LABEL } from "@/lib/processStages";
import { APPLICATION_STATUS_BADGE, CANDIDATE_APPLICATION_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { RefreshOnFocus } from "@/components/layout/RefreshOnFocus";
import { Badge, ButtonLink, Card, EmptyState, Notice, StageTrail, focusRing, textLinkClasses } from "@/components/ui";

// O que a candidatura significa para o candidato, sem expor score nem motivo interno de
// reprovação (spec 004 US3.2, FR-108).
const STATUS_MESSAGE: Record<string, string> = {
  APPROVED: "Processo concluído: você foi aprovado(a) nesta vaga.",
  REJECTED: "Processo encerrado para esta vaga. Obrigado por participar.",
  WITHDRAWN: "Candidatura retirada por você.",
};

export default async function MyApplicationsPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const params = await searchParams;
  const user = await requirePageRole(CANDIDATE_ROLES, currentPath("/candidaturas", params));
  const newApplicationId = typeof params.nova === "string" ? params.nova : null;

  const applications = await listMyApplications(user.id);

  // Pipeline completo de cada vaga, para posicionar a etapa atual na trilha (US3.1). O detalhe
  // de vaga já libera vaga despublicada para quem tem candidatura nela. Falha em uma vaga só
  // tira a trilha daquele cartão.
  const jobIds = [...new Set(applications.map((app) => app.job.id))];
  const stagesByJob = new Map(
    await Promise.all(
      jobIds.map(async (jobId) => {
        const detail = await getJobDetail(jobId, user.id).catch(() => null);
        return [jobId, detail?.stages ?? null] as const;
      }),
    ),
  );

  return (
    <PageContainer className="max-w-4xl">
      <RefreshOnFocus />
      <PageHeader
        title="Minhas Candidaturas"
        subtitle={
          applications.length > 0
            ? `${applications.length} ${applications.length === 1 ? "candidatura" : "candidaturas"}. Acompanhe em que etapa está cada processo.`
            : undefined
        }
        actions={
          applications.length > 0 ? (
            <ButtonLink href="/vagas" variant="secondary">
              Ver mais vagas
            </ButtonLink>
          ) : undefined
        }
      />

      {newApplicationId && applications.some((app) => app.applicationId === newApplicationId) && (
        <Notice tone="success" title="Candidatura registrada com sucesso!" className="mb-6">
          Ela está destacada abaixo — acompanhe por aqui cada mudança de etapa.
        </Notice>
      )}

      {applications.length === 0 ? (
        <EmptyState
          title="Você ainda não se candidatou a nenhuma vaga."
          description="Encontre uma oportunidade compatível com o seu perfil e candidate-se em um clique."
          action={<ButtonLink href="/vagas">Explorar vagas abertas</ButtonLink>}
        />
      ) : (
        <ul className="space-y-4">
          {applications.map((app) => {
            const stages = stagesByJob.get(app.job.id);
            const currentIndex = stages?.findIndex((stage) => stage.order === app.currentStage.order) ?? -1;
            const isNew = app.applicationId === newApplicationId;
            const finished = app.status !== "IN_PROGRESS";

            return (
              <Card
                as="li"
                key={app.applicationId}
                id={`candidatura-${app.applicationId}`}
                className={cn("space-y-4 p-4 sm:p-6", isNew && "border-accent-600 ring-2 ring-accent-600/30")}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-h3">
                      {/* US3.5: o item leva ao detalhe da vaga correspondente. */}
                      <Link href={`/vagas/${app.job.id}`} className={cn("break-words rounded-sm text-ink-900 hover:underline", focusRing)}>
                        {app.job.title}
                      </Link>
                    </h2>
                    <p className="text-body text-ink-600">
                      {app.job.company} · Candidatura em {new Date(app.appliedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant={APPLICATION_STATUS_BADGE[app.status]}>{CANDIDATE_APPLICATION_STATUS_LABEL[app.status]}</Badge>
                </div>

                {stages && stages.length > 0 && currentIndex >= 0 ? (
                  <div className="space-y-2">
                    <p className="text-label text-ink-600">
                      {finished
                        ? `Última etapa: ${STAGE_LABEL[app.currentStage.type] ?? app.currentStage.type}`
                        : `Etapa atual: ${STAGE_LABEL[app.currentStage.type] ?? app.currentStage.type} (${currentIndex + 1} de ${stages.length})`}
                    </p>
                    <StageTrail
                      stages={stages.map((s) => ({ type: s.type, label: STAGE_LABEL[s.type] ?? s.type }))}
                      currentIndex={currentIndex}
                      finished={finished}
                      label={`Etapas do processo de ${app.job.title}`}
                    />
                  </div>
                ) : (
                  <p className="text-body text-ink-600">Etapa atual: {STAGE_LABEL[app.currentStage.type] ?? app.currentStage.type}</p>
                )}

                {STATUS_MESSAGE[app.status] && <p className="text-body text-ink-900">{STATUS_MESSAGE[app.status]}</p>}

                <Link href={`/vagas/${app.job.id}`} className={cn(textLinkClasses, "inline-block text-body")}>
                  Ver vaga
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
