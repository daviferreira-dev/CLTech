"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_LABEL } from "@/lib/processStages";
import { CASE_OUTCOME_LABEL, LANGUAGE_LABEL } from "@/lib/codeTest";
import type { CodeTestReport } from "@/server/code-test/report";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { APPLICATION_STATUS_BADGE, PROVIDER_LABEL, RECRUITER_APPLICATION_STATUS_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { ProfileDetails } from "@/lib/profile-details";
import { ProfessionalProfileCard } from "./ProfessionalProfileCard";
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
  justification: { matched?: string[]; missing?: string[] } | null;
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

  async function handleDecision(decision: Decision) {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    const result = await apiFetch<{ status: ApplicationDetailData["status"]; currentStage: { type: string; order: number } }>(
      `/api/recruiter/applications/${applicationId}/decision`,
      jsonInit("POST", { decision }),
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
      setMessage({ tone: decision === "REJECT" ? "info" : "success", text });
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
    return <ErrorState title="Não foi possível carregar o relatório." onRetry={load} />;
  }

  const mainEvaluation = data.evaluations.find((e) => e.type === "RESUME_MATCH");
  const otherEvaluations = data.evaluations.filter((e) => e.type !== "RESUME_MATCH");
  const currentIndex = stages?.findIndex((s) => s.order === data.currentStage.order) ?? -1;
  const isLastStage = stages ? currentIndex === stages.length - 1 : false;
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
        actions={<Badge variant={APPLICATION_STATUS_BADGE[data.status]}>{RECRUITER_APPLICATION_STATUS_LABEL[data.status]}</Badge>}
      />

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <Card as="section" aria-labelledby="etapa-atual">
        <CardHeader titleId="etapa-atual" title="Processo" description={`Etapa atual: ${currentLabel}`} />
        <CardBody>
          {stages && currentIndex >= 0 ? (
            <StageTrail
              stages={stages.map((s) => ({ type: s.type, label: STAGE_LABEL[s.type] ?? s.type }))}
              currentIndex={currentIndex}
              finished={data.status !== "IN_PROGRESS"}
            />
          ) : (
            <p className="text-body text-ink-600">Etapa atual: {currentLabel}</p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card as="section" aria-labelledby="match">
          <CardHeader titleId="match" title="Compatibilidade" />
          <CardBody className="space-y-4">
            {mainEvaluation ? (
              <>
                <div>
                  <p className="text-display text-ink-900">{mainEvaluation.score}%</p>
                  <p className="text-body text-ink-600">compatibilidade geral</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="text-label text-ink-600">Encontradas</h3>
                    <ChipList items={mainEvaluation.justification?.matched ?? []} tone="found" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-label text-ink-600">Faltando</h3>
                    <ChipList items={mainEvaluation.justification?.missing ?? []} tone="missing" />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-body text-ink-600">Sem avaliação de currículo registrada.</p>
            )}
            {otherEvaluations.map((evaluation) => (
              <div key={evaluation.type} className="rounded-card border border-brand-100 p-3">
                <p className="text-body font-medium text-ink-900">
                  {EVALUATION_LABEL[evaluation.type] ?? evaluation.type}: {evaluation.score}%
                </p>
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
                <p className="text-body text-ink-600">Nenhum currículo.</p>
              )}
            </CardBody>
          </Card>

          <Card as="section" aria-labelledby="contas-candidato">
            <CardHeader titleId="contas-candidato" title="Contas externas" />
            <CardBody>
              {data.externalAccounts.length === 0 ? (
                <p className="text-body text-ink-600">Nenhuma conta conectada.</p>
              ) : (
                <ul className="space-y-2">
                  {data.externalAccounts.map((account) => (
                    <li key={account.provider} className="flex items-center justify-between gap-2 text-body text-ink-900">
                      <span className="min-w-0 break-all">
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
                          <span className="block text-label text-ink-600">
                            {account.verified
                              ? `Conta ${account.verifiedName ? `de ${account.verifiedName} ` : ""}confirmada por login no ${PROVIDER_LABEL[account.provider] ?? account.provider}.`
                              : "Link informado pelo candidato, sem verificação."}
                          </span>
                        )}
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

      <Card as="section" aria-labelledby="decisao">
        <CardHeader
          titleId="decisao"
          title="Decisão"
          description={
            data.status === "IN_PROGRESS"
              ? isLastStage
                ? "Esta é a última etapa: avançar aprova o candidato."
                : "A decisão é sempre humana — a nota automática nunca move o candidato de etapa."
              : undefined
          }
        />
        <CardBody>
          {data.status === "IN_PROGRESS" ? (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setPending("ADVANCE")} disabled={saving}>
                {isLastStage ? "Avançar e aprovar" : "Avançar"}
              </Button>
              <Button variant="danger" onClick={() => setPending("REJECT")} disabled={saving}>
                Reprovar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-body text-ink-900">
                Candidatura {data.status === "APPROVED" ? "aprovada" : data.status === "REJECTED" ? "reprovada" : "retirada"}.
              </p>
              <ButtonLink href={backHref} variant="secondary">
                {origin.kind === "search" ? "Voltar à busca" : "Voltar às candidaturas"}
              </ButtonLink>
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={pending === "ADVANCE"}
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
      <details open={!passed} className="rounded-field border border-brand-100 bg-surface">
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-body text-ink-900">
          <span className="font-medium">Caso {item.index + 1}</span>
          <span className="text-ink-600">{item.hidden ? "oculto" : "visível ao candidato"}</span>
          <Badge variant={passed ? "success" : "danger"}>{CASE_OUTCOME_LABEL[item.outcome] ?? item.outcome}</Badge>
        </summary>
        <dl className="grid gap-3 border-t border-brand-100 px-3 py-3 sm:grid-cols-3">
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
      <dt className="text-label text-ink-600">{label}</dt>
      <dd className="mt-1">
        {value ? (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-field bg-canvas p-2 font-mono text-label font-normal text-ink-900">
            {value}
          </pre>
        ) : (
          <span className="text-label font-normal text-ink-600">{empty}</span>
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
      body = <p className="text-body text-ink-600">Esta vaga não tem etapa de teste de código.</p>;
      break;
    case "NOT_STARTED":
      body = (
        <p className="text-body text-ink-600">
          {report.challengeTitle ? `Desafio "${report.challengeTitle}" ainda não iniciado pelo candidato.` : "Etapa sem desafio configurado."}
        </p>
      );
      break;
    case "IN_PROGRESS":
      body = (
        <p className="text-body text-ink-600">
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
              <p className="text-display text-ink-900">{report.score}%</p>
              <p className="text-body text-ink-600">
                {report.passed} de {report.total} casos aprovados
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-body">
              <dt className="text-ink-600">Linguagem</dt>
              <dd className="text-ink-900">{LANGUAGE_LABEL[report.language] ?? report.language}</dd>
              <dt className="text-ink-600">Tempo gasto</dt>
              <dd className="text-ink-900">{formatDuration(report.timeSpentSeconds)}</dd>
              <dt className="text-ink-600">Envio</dt>
              <dd className="text-ink-900">{report.submittedBy === "TIME_EXPIRED" ? "Automático (tempo esgotado)" : "Pelo candidato"}</dd>
            </dl>
          </div>
          <p className="text-label font-normal text-ink-600">
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
              <pre className="mt-3 max-h-96 overflow-auto rounded-field bg-brand-900 p-3 font-mono text-label font-normal text-surface">
                {report.sourceCode}
              </pre>
            )}
          </div>
          <p className="text-label font-normal text-ink-600">A nota é informativa: avançar ou reprovar continua sendo decisão sua.</p>
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
