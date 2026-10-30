"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { INTERVIEW_STAGES, RECOMMENDATION_THRESHOLD, STAGE_LABEL } from "@/lib/processStages";
import { CASE_OUTCOME_LABEL, LANGUAGE_LABEL } from "@/lib/codeTest";
import type { CodeTestReport } from "@/server/code-test/report";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { APPLICATION_STATUS_BADGE, PROVIDER_LABEL, RECRUITER_APPLICATION_STATUS_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { ProfileDetails } from "@/lib/profile-details";
import { ProfessionalProfileCard } from "./ProfessionalProfileCard";
import { MeetingDialog } from "./MeetingDialog";
import { ProviderIcon } from "@/components/ui/BrandIcons";
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ChipList,
  ErrorState,
  Notice,
  Skeleton,
  StageTrail,
  textLinkClasses,
  type Crumb,
} from "@/components/ui";

interface EvaluationView {
  type: string;
  score: number;
  justification: {
    matched?: string[];
    missing?: string[];
    resumeReadable?: boolean;
    username?: string | null;
    publicRepoCount?: number;
    followers?: number;
    activityLast90Days?: number;
    topLanguages?: Array<{ name: string; share: number }>;
    collectedAt?: string | null;
    note?: string | null;
  } | null;
}

interface ApplicationDetailData {
  id: string;
  candidate: { name: string; email: string };
  professionalProfile: ProfileDetails;
  job: { id: string; title: string };
  currentStage: { type: string; order: number };
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  evaluations: EvaluationView[];
  externalAccounts: Array<{
    provider: string;
    status: string;
    externalUsername: string | null;
    url: string | null;
    verified: boolean;
    verifiedName: string | null;
  }>;
  resume: { id: string; originalFilename: string } | null;
  codeTest: CodeTestReport;
}

export type ReportOrigin = { kind: "job"; stage: string } | { kind: "search"; q: string };

const EVALUATION_LABEL: Record<string, string> = {
  RESUME_MATCH: "Compatibilidade geral",
  GITHUB_ANALYSIS: "Análise de GitHub",
  CODE_TEST: "Teste de código",
};

const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  CONNECTED: "Conectado",
  PENDING: "Sincronizando",
  UNAVAILABLE: "Indisponível",
  DISCONNECTED: "Não conectado",
};

type Decision = "ADVANCE" | "REJECT";

export function ApplicationDetailView({
  jobId,
  applicationId,
  origin,
}: {
  jobId: string;
  applicationId: string;
  origin: ReportOrigin;
}) {
  const router = useRouter();
  const [data, setData] = useState<ApplicationDetailData | null>(null);
  const [stages, setStages] = useState<Array<{ type: string; order: number }> | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed" | "notFound">("loading");
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Decision | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);

  const fetchDetail = useCallback(async () => {
    const result = await apiFetch<ApplicationDetailData>(`/api/recruiter/applications/${applicationId}`);
    if (result.ok) {
      setData(result.data);
      setLoadState("ready");
      return result.data;
    }
    setLoadState(result.status === 404 ? "notFound" : "failed");
    return null;
  }, [applicationId]);

  const load = useCallback(async () => {
    setLoadState("loading");
    const [detail, job] = await Promise.all([fetchDetail(), apiFetch<{ stages: Array<{ type: string; order: number }> }>(`/api/recruiter/jobs/${jobId}`)]);
    if (job.ok) setStages(job.data.stages);
    void detail;
  }, [fetchDetail, jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecision(decision: Decision, meeting?: { scheduledAt: string; url: string }) {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    const result = await apiFetch<{ status: ApplicationDetailData["status"]; currentStage: { type: string; order: number } }>(
      `/api/recruiter/applications/${applicationId}/decision`,
      jsonInit("POST", { decision, meeting }),
    );
    setSaving(false);
    setPending(null);

    if (result.ok) {
      // US5.5: a nova etapa (ou a aprovação final) fica explícita na tela.
      const text =
        decision === "REJECT"
          ? "Candidato reprovado."
          : result.data.status === "APPROVED"
            ? "Candidato aprovado — era a última etapa. A vaga foi encerrada e os demais candidatos em andamento foram reprovados."
            : `Candidato avançado. Etapa atual: ${STAGE_LABEL[result.data.currentStage.type] ?? result.data.currentStage.type}.`;
      if (decision === "ADVANCE") {
        // Aprovado na etapa: volta para a vaga, que mostra o aviso com o destino do candidato.
        const params = new URLSearchParams();
        if (origin.kind === "job" && origin.stage) params.set("etapa", origin.stage);
        params.set("aprovado", data?.candidate.name ?? "Candidato");
        params.set(
          "destino",
          result.data.status === "APPROVED" ? "FINAL" : (STAGE_LABEL[result.data.currentStage.type] ?? result.data.currentStage.type),
        );
        // Navegação completa: garante sair do candidato e recarregar a lista já com a nova etapa.
        window.location.assign(`/recrutamento/vagas/${jobId}/candidaturas?${params.toString()}`);
        return;
      }
      setMessage({ tone: "info", text });
      await fetchDetail();
      router.refresh();
      return;
    }
    if (result.status === 401) return;
    if (result.networkError) {
      setMessage({ tone: "danger", text: NETWORK_ERROR_MESSAGE });
      return;
    }
    if (result.error?.code === "APPLICATION_CLOSED") {
      // US5.7: outro recrutador já decidiu — mostra o estado real em vez de insistir.
      await fetchDetail();
      setMessage({ tone: "info", text: "Esta candidatura já foi decidida por outra pessoa. A tela mostra o estado atual." });
      return;
    }
    setMessage({ tone: "danger", text: result.error?.message ?? "Não foi possível registrar a decisão." });
  }

  const jobTitle = data?.job.title ?? "Vaga";
  const listHref = `/recrutamento/vagas/${jobId}/candidaturas${origin.kind === "job" && origin.stage ? `?etapa=${origin.stage}` : ""}`;
  const crumbs: Crumb[] =
    origin.kind === "search"
      ? [
          { label: "Painel", href: "/recrutamento" },
          { label: "Candidatos", href: `/recrutamento/candidatos${origin.q ? `?q=${encodeURIComponent(origin.q)}` : ""}` },
          { label: data?.candidate.name ?? "Candidato" },
        ]
      : [
          { label: "Painel", href: "/recrutamento" },
          { label: jobTitle, href: `/recrutamento/vagas/${jobId}` },
          { label: "Candidaturas", href: listHref },
          { label: data?.candidate.name ?? "Candidato" },
        ];
  const backHref = origin.kind === "search" ? (crumbs[1]?.href ?? "/recrutamento/candidatos") : listHref;

  if (loadState === "loading" && !data) {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <span className="sr-only">Carregando relatório…</span>
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }
  if (loadState === "notFound") {
    return (
      <ErrorState
        title="Candidatura não encontrada."
        action={
          <ButtonLink href={backHref} variant="secondary">
            Voltar
          </ButtonLink>
        }
      />
    );
  }
  if (loadState === "failed" || !data) {
    return <ErrorState title="Não conseguimos abrir o relatório agora." onRetry={load} action={<ButtonLink href={backHref} variant="ghost">Voltar</ButtonLink>} />;
  }

  const mainEvaluation = data.evaluations.find((e) => e.type === "RESUME_MATCH");
  const otherEvaluations = data.evaluations.filter((e) => e.type !== "RESUME_MATCH");
  const currentIndex = stages?.findIndex((s) => s.order === data.currentStage.order) ?? -1;
  const isLastStage = stages ? currentIndex === stages.length - 1 : false;
  const nextStage = stages && currentIndex >= 0 ? stages[currentIndex + 1] : undefined;
  const nextIsInterview = !!nextStage && INTERVIEW_STAGES.includes(nextStage.type);
  const nextStageLabel = nextStage ? (STAGE_LABEL[nextStage.type] ?? nextStage.type) : "";
  const currentLabel = STAGE_LABEL[data.currentStage.type] ?? data.currentStage.type;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={<Breadcrumb items={crumbs} />}
        title={data.candidate.name}
        subtitle={
          <span className="break-all sm:break-words">
            {data.candidate.email} · {data.job.title}
          </span>
        }
      />

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {/* A tela existe para decidir: compatibilidade, recomendação, etapa e ação lideram; os cartões abaixo são o detalhe. */}
      <Card as="section" aria-labelledby="decisao" className="border-action/30">
        <h2 id="decisao" className="sr-only">
          Decisão
        </h2>
        <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-8">
          <div className="flex items-center gap-4 md:block">
            <p className="font-display text-[40px] font-semibold leading-none text-fg tabular-nums">
              {mainEvaluation ? `${mainEvaluation.score}%` : "—"}
            </p>
            <div className="md:mt-2">
              <p className="text-body text-fg-muted">compatibilidade geral</p>
              {mainEvaluation && data.status === "IN_PROGRESS" && (
                <Badge variant={mainEvaluation.score >= RECOMMENDATION_THRESHOLD ? "success" : "warning"} className="mt-1">
                  {mainEvaluation.score >= RECOMMENDATION_THRESHOLD ? "Recomendado" : "Não recomendado"}
                </Badge>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-body text-fg">
              <span>
                Etapa atual: <span className="font-semibold">{currentLabel}</span>
              </span>
              <Badge variant={APPLICATION_STATUS_BADGE[data.status]}>{RECRUITER_APPLICATION_STATUS_LABEL[data.status]}</Badge>
            </p>
            {stages && currentIndex >= 0 && (
              <StageTrail
                stages={stages.map((s) => ({ type: s.type, label: STAGE_LABEL[s.type] ?? s.type }))}
                currentIndex={currentIndex}
                finished={data.status !== "IN_PROGRESS"}
              />
            )}
            {data.status === "IN_PROGRESS" && (
              <p className="text-label font-normal text-fg-muted">
                {isLastStage
                  ? "Esta é a última etapa: avançar aprova o candidato."
                  : "A decisão é sempre humana — a nota automática nunca move o candidato de etapa."}
              </p>
            )}
          </div>

          {data.status === "IN_PROGRESS" ? (
            <div className="flex flex-wrap gap-3 md:flex-col md:items-stretch">
              <Button onClick={() => setPending("ADVANCE")} disabled={saving}>
                {isLastStage ? "Avançar e aprovar" : "Avançar"}
              </Button>
              <Button variant="danger" onClick={() => setPending("REJECT")} disabled={saving}>
                Reprovar
              </Button>
            </div>
          ) : (
            <div className="space-y-2 md:text-right">
              <p className="text-body text-fg">
                Candidatura {data.status === "APPROVED" ? "aprovada" : data.status === "REJECTED" ? "reprovada" : "retirada"}.
              </p>
              <ButtonLink href={backHref} variant="secondary">
                {origin.kind === "search" ? "Voltar à busca" : "Voltar às candidaturas"}
              </ButtonLink>
            </div>
          )}
        </div>
        {/* Só aviso: a regra continua deixando a pessoa decidir sem o envio. */}
        {data.status === "IN_PROGRESS" &&
          data.currentStage.type === "CODE_TEST" &&
          (data.codeTest.status === "NOT_STARTED" || data.codeTest.status === "IN_PROGRESS") && (
            <div className="border-t border-line px-4 py-3 sm:px-6">
              <Notice tone="warning">O candidato ainda não enviou o teste de código. Avançar agora pula a correção automática.</Notice>
            </div>
          )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card as="section" aria-labelledby="match">
          <CardHeader titleId="match" title="Compatibilidade" description="Tecnologias da vaga encontradas no currículo e no perfil." />
          <CardBody className="space-y-4">
            {mainEvaluation ? (
              <>
                {mainEvaluation.justification?.resumeReadable === false && (
                  <p className="text-body text-fg-muted">
                    Não foi possível ler o texto do currículo; a nota considera só as tecnologias do perfil.
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="text-label text-fg-muted">Encontradas</h3>
                    <ChipList items={mainEvaluation.justification?.matched ?? []} tone="found" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-label text-fg-muted">Faltando</h3>
                    <ChipList items={mainEvaluation.justification?.missing ?? []} tone="missing" />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-body text-fg-muted">Sem avaliação de currículo registrada.</p>
            )}
            {otherEvaluations.map((evaluation) => (
              <div key={evaluation.type} className="rounded-card border border-line p-3">
                <p className="text-body font-medium text-fg">
                  {EVALUATION_LABEL[evaluation.type] ?? evaluation.type}: {evaluation.score}%
                </p>
                {evaluation.type === "GITHUB_ANALYSIS" && evaluation.justification && (
                  <div className="mt-2 space-y-2 text-body text-fg-muted">
                    {evaluation.justification.note && <p>{evaluation.justification.note}</p>}
                    <p>
                      {evaluation.justification.publicRepoCount ?? 0} repositórios públicos ·{" "}
                      {evaluation.justification.activityLast90Days ?? 0} eventos recentes ·{" "}
                      {evaluation.justification.followers ?? 0} seguidores
                    </p>
                    {(evaluation.justification.topLanguages ?? []).length > 0 && (
                      <p>
                        Linguagens:{" "}
                        {(evaluation.justification.topLanguages ?? [])
                          .map((lang) => `${lang.name} ${Math.round(lang.share * 100)}%`)
                          .join(", ")}
                      </p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ChipList items={evaluation.justification.matched ?? []} tone="found" />
                      <ChipList items={evaluation.justification.missing ?? []} tone="missing" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card as="section" aria-labelledby="curriculo-candidato">
            <CardHeader titleId="curriculo-candidato" title="Currículo" />
            <CardBody>
              {data.resume ? (
                // US5.4: download autenticado em outra aba, sem tirar o recrutador do relatório.
                <a href={`/api/resumes/${data.resume.id}/download`} target="_blank" rel="noopener noreferrer" className={`${textLinkClasses} break-all text-body`}>
                  {data.resume.originalFilename}
                </a>
              ) : (
                <p className="text-body text-fg-muted">Nenhum currículo.</p>
              )}
            </CardBody>
          </Card>

          <Card as="section" aria-labelledby="contas-candidato">
            <CardHeader titleId="contas-candidato" title="Contas externas" />
            <CardBody>
              {data.externalAccounts.length === 0 ? (
                <p className="text-body text-fg-muted">Nenhuma conta conectada.</p>
              ) : (
                <ul className="space-y-2">
                  {data.externalAccounts.map((account) => (
                    <li key={account.provider} className="flex items-center justify-between gap-2 text-body text-fg">
                      <span className="flex min-w-0 items-start gap-3 break-all">
                        <span aria-hidden="true" className={account.provider === "GITHUB" ? "mt-0.5 shrink-0 text-fg" : "mt-0.5 shrink-0"}>
                          <ProviderIcon provider={account.provider} />
                        </span>
                        <span className="min-w-0">
                        {PROVIDER_LABEL[account.provider] ?? account.provider}
                        {/* Vínculo desfeito pelo candidato não expõe mais o perfil. */}
                        {account.status !== "DISCONNECTED" && account.url && (
                          <>
                            {" · "}
                            <a href={account.url} target="_blank" rel="noopener noreferrer" className={textLinkClasses}>
                              {account.externalUsername ?? "ver perfil"}
                            </a>
                          </>
                        )}
                        {account.status !== "DISCONNECTED" && (
                          <span className="block text-label text-fg-muted">
                            {account.verified
                              ? `Conta ${account.verifiedName ? `de ${account.verifiedName} ` : ""}confirmada por login no ${PROVIDER_LABEL[account.provider] ?? account.provider}.`
                              : "Link informado pelo candidato, sem verificação."}
                          </span>
                        )}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-2">
                        {account.status !== "DISCONNECTED" && account.verified && <Badge variant="success">Verificado</Badge>}
                        <Badge variant={account.status === "CONNECTED" ? "success" : account.status === "UNAVAILABLE" ? "warning" : "muted"}>
                          {ACCOUNT_STATUS_LABEL[account.status] ?? account.status}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

        </div>
      </div>

      <CodeTestCard report={data.codeTest} />

      <ProfessionalProfileCard profile={data.professionalProfile} />

      <MeetingDialog
        open={pending === "ADVANCE" && nextIsInterview}
        title={`Agendar ${nextStageLabel}`}
        description={`${data.candidate.name} vai para "${nextStageLabel}". Informe quando será a reunião; o candidato recebe a data e o link por e-mail.`}
        loading={saving}
        onCancel={() => setPending(null)}
        onConfirm={(meeting) => handleDecision("ADVANCE", meeting)}
      />
      <ConfirmDialog
        open={pending === "ADVANCE" && !nextIsInterview}
        title={isLastStage ? "Aprovar candidato?" : "Avançar candidato?"}
        description={
          isLastStage
            ? `${data.candidate.name} está na última etapa. Avançar conclui o processo como aprovado.`
            : `${data.candidate.name} sai de "${currentLabel}" e vai para "${stages && stages[currentIndex + 1] ? (STAGE_LABEL[stages[currentIndex + 1]!.type] ?? stages[currentIndex + 1]!.type) : "a próxima etapa"}".`
        }
        confirmLabel={isLastStage ? "Confirmar aprovação" : "Confirmar avanço"}
        loading={saving}
        onCancel={() => setPending(null)}
        onConfirm={() => handleDecision("ADVANCE")}
      />
      <ConfirmDialog
        open={pending === "REJECT"}
        title="Reprovar candidato?"
        description={`A candidatura de ${data.candidate.name} será encerrada. Esta decisão não pode ser desfeita.`}
        confirmLabel="Confirmar reprovação"
        tone="danger"
        loading={saving}
        onCancel={() => setPending(null)}
        onConfirm={() => handleDecision("REJECT")}
      />
    </div>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}min` : `${m}min ${seconds % 60}s`;
}

/** Spec 005 US3.6: nota, casos, linguagem, tempo gasto e código submetido. */
type CaseItem = Extract<CodeTestReport, { status: "COMPLETED" }>["cases"][number];

/** Um caso de teste: reprovados já abrem expandidos, que é o que o recrutador quer entender. */
function CaseRow({ item }: { item: CaseItem }) {
  const passed = item.outcome === "PASSED";
  return (
    <li>
      <details open={!passed} className="rounded-field border border-line bg-surface">
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-body text-fg">
          <span className="font-medium">Caso {item.index + 1}</span>
          <span className="text-fg-muted">{item.hidden ? "oculto" : "visível ao candidato"}</span>
          <Badge variant={passed ? "success" : "danger"}>{CASE_OUTCOME_LABEL[item.outcome] ?? item.outcome}</Badge>
        </summary>
        <dl className="grid gap-3 border-t border-line px-3 py-3 sm:grid-cols-3">
          <CaseField label="Entrada" value={item.input} />
          <CaseField label="Saída esperada" value={item.expectedOutput} />
          <CaseField
            label="Saída do candidato"
            value={item.actualOutput}
            empty={item.actualOutput === null ? "Não registrada (correção anterior a esta versão)" : "(vazia)"}
          />
          {!passed && item.diagnostics && (
            <div className="sm:col-span-3">
              <CaseField label="Erro" value={item.diagnostics} />
            </div>
          )}
        </dl>
      </details>
    </li>
  );
}

function CaseField({ label, value, empty = "(vazia)" }: { label: string; value: string | null; empty?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-label text-fg-muted">{label}</dt>
      <dd className="mt-1">
        {value ? (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-field bg-page p-2 font-mono text-label font-normal text-fg">
            {value}
          </pre>
        ) : (
          <span className="text-label font-normal text-fg-muted">{empty}</span>
        )}
      </dd>
    </div>
  );
}

function CodeTestCard({ report }: { report: CodeTestReport }) {
  const [showCode, setShowCode] = useState(false);

  let body: React.ReactNode;
  switch (report.status) {
    case "NOT_APPLICABLE":
      body = <p className="text-body text-fg-muted">Esta vaga não tem etapa de teste de código.</p>;
      break;
    case "NOT_STARTED":
      body = (
        <p className="text-body text-fg-muted">
          {report.challengeTitle ? `Desafio "${report.challengeTitle}" ainda não iniciado pelo candidato.` : "Etapa sem desafio configurado."}
        </p>
      );
      break;
    case "IN_PROGRESS":
      body = (
        <p className="text-body text-fg-muted">
          Candidato resolvendo &quot;{report.challengeTitle}&quot;. Prazo: {new Date(report.deadline).toLocaleString("pt-BR")}.
        </p>
      );
      break;
    case "GRADING":
      body = <Notice tone="info">Submissão recebida em {new Date(report.submittedAt).toLocaleString("pt-BR")}. Correção em andamento.</Notice>;
      break;
    case "FAILED":
      // NFR-202: falha persistente do sandbox fica visível ao recrutador, sem quebrar a tela.
      body = (
        <Notice tone="warning" title="Correção automática falhou">
          O ambiente de execução falhou nesta submissão. O código está guardado e a correção é tentada de novo
          automaticamente (no máximo a cada 5 minutos) sempre que esta página ou a do candidato é aberta com o ambiente
          disponível.
        </Notice>
      );
      break;
    case "COMPLETED":
      body = (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-display text-fg">{report.score}%</p>
              <p className="text-body text-fg-muted">
                {report.passed} de {report.total} casos aprovados
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-body">
              <dt className="text-fg-muted">Linguagem</dt>
              <dd className="text-fg">{LANGUAGE_LABEL[report.language] ?? report.language}</dd>
              <dt className="text-fg-muted">Tempo gasto</dt>
              <dd className="text-fg">{formatDuration(report.timeSpentSeconds)}</dd>
              <dt className="text-fg-muted">Envio</dt>
              <dd className="text-fg">{report.submittedBy === "TIME_EXPIRED" ? "Automático (tempo esgotado)" : "Pelo candidato"}</dd>
            </dl>
          </div>
          <p className="text-label font-normal text-fg-muted">
            Nota = casos aprovados ÷ total de casos, contando os ocultos (que o candidato não vê). A saída é comparada
            linha a linha, ignorando espaços no fim.
          </p>
          <ul className="space-y-2" aria-label="Resultado por caso">
            {report.cases.map((c) => (
              <CaseRow key={c.index} item={c} />
            ))}
          </ul>
          <div>
            <Button variant="secondary" size="sm" onClick={() => setShowCode((v) => !v)} aria-expanded={showCode}>
              {showCode ? "Ocultar código" : "Ver código submetido"}
            </Button>
            {showCode && (
              <pre className="mt-3 max-h-96 overflow-auto rounded-field bg-inverse p-3 font-mono text-label font-normal text-on-color">
                {report.sourceCode}
              </pre>
            )}
          </div>
          <p className="text-label font-normal text-fg-muted">A nota é informativa: avançar ou reprovar continua sendo decisão sua.</p>
        </div>
      );
      break;
  }

  return (
    <Card as="section" aria-labelledby="teste-codigo">
      <CardHeader
        titleId="teste-codigo"
        title="Teste de código"
        description={"challengeTitle" in report && report.challengeTitle && report.status !== "NOT_STARTED" ? report.challengeTitle : undefined}
      />
      <CardBody>{body}</CardBody>
    </Card>
  );
}
