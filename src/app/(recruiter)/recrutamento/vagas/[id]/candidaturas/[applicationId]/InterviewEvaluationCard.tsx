"use client";

// Spec 009: ficha de entrevista padronizada (mesmos critérios para todo entrevistador) e o
// histórico de fichas por etapa, com médias. Só o RH vê; a ficha nunca vai ao candidato pela tela.
import { useCallback, useEffect, useState } from "react";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { STAGE_LABEL } from "@/lib/processStages";
import {
  INTERVIEW_COMMENT_MAX,
  INTERVIEW_CRITERIA,
  INTERVIEW_RECOMMENDATION_LABEL,
  INTERVIEW_SCORE_MAX,
  INTERVIEW_SCORE_MIN,
} from "@/lib/interviewCriteria";
import { Badge, Button, Card, CardBody, CardHeader, Field, Icon, Notice, Textarea } from "@/components/ui";

type Recommendation = "ADVANCE" | "UNSURE" | "REJECT";

interface EvaluationView {
  id: string;
  evaluatorName: string;
  mine: boolean;
  scores: Record<string, number>;
  average: number | null;
  comment: string | null;
  recommendation: Recommendation;
  updatedAt: string;
}

interface StageGroup {
  stageId: string;
  stageType: string;
  current: boolean;
  averages: Record<string, number | null>;
  evaluations: EvaluationView[];
}

const RECOMMENDATION_BADGE: Record<Recommendation, "success" | "warning" | "danger"> = {
  ADVANCE: "success",
  UNSURE: "warning",
  REJECT: "danger",
};

const SCORES = Array.from({ length: INTERVIEW_SCORE_MAX - INTERVIEW_SCORE_MIN + 1 }, (_, i) => INTERVIEW_SCORE_MIN + i);

export function InterviewEvaluationCard({
  applicationId,
  currentStageType,
  canEvaluate,
  onCurrentCountChange,
}: {
  applicationId: string;
  currentStageType: string;
  /** Candidatura em andamento numa etapa de entrevista. */
  canEvaluate: boolean;
  /** Quantas fichas existem na etapa atual (o relatório avisa ao avançar sem nenhuma). */
  onCurrentCountChange: (count: number) => void;
}) {
  const [groups, setGroups] = useState<StageGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const criteria = INTERVIEW_CRITERIA[currentStageType] ?? [];

  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<Recommendation | "">("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const apply = useCallback(
    (stages: StageGroup[]) => {
      setGroups(stages);
      const current = stages.find((g) => g.current);
      onCurrentCountChange(current?.evaluations.length ?? 0);
      const mine = current?.evaluations.find((e) => e.mine);
      if (mine) {
        setScores(mine.scores);
        setRecommendation(mine.recommendation);
        setComment(mine.comment ?? "");
      }
    },
    [onCurrentCountChange],
  );

  const load = useCallback(async () => {
    setFailed(false);
    const result = await apiFetch<{ stages: StageGroup[] }>(`/api/recruiter/applications/${applicationId}/interview-evaluation`);
    if (result.ok && Array.isArray(result.data?.stages)) apply(result.data.stages);
    else setFailed(true);
  }, [applicationId, apply]);

  useEffect(() => {
    load();
  }, [load, currentStageType]);

  const missing = criteria.filter((c) => !scores[c.key]);
  const canSave = missing.length === 0 && recommendation !== "";
  const hasMine = groups?.some((g) => g.current && g.evaluations.some((e) => e.mine)) ?? false;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    setMessage(null);
    const result = await apiFetch<{ stages: StageGroup[] }>(
      `/api/recruiter/applications/${applicationId}/interview-evaluation`,
      jsonInit("PUT", { scores, recommendation, comment: comment.trim() || undefined }),
    );
    setSaving(false);
    if (result.ok) {
      apply(result.data.stages);
      setMessage({ tone: "success", text: "Ficha salva." });
      return;
    }
    if (result.status === 401) return;
    setMessage({ tone: "danger", text: result.networkError ? NETWORK_ERROR_MESSAGE : (result.error?.message ?? "Não foi possível salvar a ficha.") });
  }

  // Sem etapa de entrevista agora e sem fichas antigas: o cartão não tem o que mostrar.
  if (!canEvaluate && groups !== null && groups.length === 0) return null;

  return (
    <Card as="section" aria-labelledby="ficha-entrevista">
      <CardHeader
        titleId="ficha-entrevista"
        title="Ficha de entrevista"
        description="Mesmos critérios para todo entrevistador, de 1 (fraco) a 5 (excelente). Só a equipe vê."
      />
      <CardBody className="space-y-6">
        {failed && <Notice tone="danger">Não conseguimos carregar as fichas. Recarregue a página.</Notice>}

        {canEvaluate && (
          <form onSubmit={save} className="space-y-4" aria-label="Sua ficha">
            <p className="text-body font-medium text-fg">
              {hasMine ? "Sua ficha" : "Preencher sua ficha"} — {STAGE_LABEL[currentStageType] ?? currentStageType}
            </p>
            {criteria.map((criterion) => (
              <fieldset key={criterion.key} className="space-y-1.5">
                <legend className="text-label text-fg-muted">{criterion.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {SCORES.map((value) => (
                    <label
                      key={value}
                      className="flex h-10 min-w-10 cursor-pointer items-center justify-center rounded-field border border-fg-subtle/40 px-3 text-body text-fg has-[:checked]:border-action has-[:checked]:bg-action has-[:checked]:text-on-color has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action"
                    >
                      <input
                        type="radio"
                        name={`criterio-${criterion.key}`}
                        value={value}
                        checked={scores[criterion.key] === value}
                        onChange={() => setScores((prev) => ({ ...prev, [criterion.key]: value }))}
                        className="sr-only"
                      />
                      {value}
                    </label>
                  ))}
                </div>
                {/* Só dica ao entrevistador: fechada por padrão, não muda a nota nem o que é gravado. */}
                <details className="group">
                  <summary className="inline-flex min-h-6 cursor-pointer list-none items-center gap-1 rounded-sm text-label font-normal text-fg-muted hover:text-fg">
                    <Icon name="chevronDown" className="transition-transform group-open:rotate-180" />
                    Perguntas sugeridas
                  </summary>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-label font-normal text-fg-muted">
                    {criterion.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </details>
              </fieldset>
            ))}
            <fieldset className="space-y-1.5">
              <legend className="text-label text-fg-muted">Recomendação</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(INTERVIEW_RECOMMENDATION_LABEL) as Recommendation[]).map((value) => (
                  <label
                    key={value}
                    className="flex h-10 cursor-pointer items-center rounded-field border border-fg-subtle/40 px-3 text-body text-fg has-[:checked]:border-action has-[:checked]:bg-action has-[:checked]:text-on-color has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-action"
                  >
                    <input
                      type="radio"
                      name="recomendacao"
                      value={value}
                      checked={recommendation === value}
                      onChange={() => setRecommendation(value)}
                      className="sr-only"
                    />
                    {INTERVIEW_RECOMMENDATION_LABEL[value]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field
              id="ficha-comentario"
              label="Comentário (opcional)"
              hint={`O candidato pode ter acesso a esta avaliação se pedir os dados dele (LGPD). ${comment.length}/${INTERVIEW_COMMENT_MAX}`}
            >
              <Textarea rows={4} maxLength={INTERVIEW_COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
            {message && <Notice tone={message.tone}>{message.text}</Notice>}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={saving} disabled={!canSave}>
                {hasMine ? "Atualizar ficha" : "Salvar ficha"}
              </Button>
              {!canSave && <span className="text-label font-normal text-fg-muted">Dê nota a todos os critérios e escolha a recomendação.</span>}
            </div>
          </form>
        )}

        {groups?.map((group) => (
          <div key={group.stageId} className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
            <h3 className="text-h3 text-fg">
              {STAGE_LABEL[group.stageType] ?? group.stageType}
              <span className="ml-2 text-body font-normal text-fg-muted">
                · {group.evaluations.length} ficha{group.evaluations.length === 1 ? "" : "s"}
              </span>
            </h3>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {(INTERVIEW_CRITERIA[group.stageType] ?? []).map((c) => (
                <div key={c.key} className="flex justify-between gap-3 text-body">
                  <dt className="text-fg-muted">{c.label}</dt>
                  <dd className="font-medium tabular-nums text-fg">{group.averages[c.key] ?? "—"}</dd>
                </div>
              ))}
            </dl>
            <ul className="space-y-3">
              {group.evaluations.map((evaluation) => (
                <li key={evaluation.id} className="rounded-card border border-line bg-page p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-medium text-fg">
                      {evaluation.evaluatorName}
                      {evaluation.mine && " (você)"}
                    </span>
                    <Badge variant={RECOMMENDATION_BADGE[evaluation.recommendation]}>
                      {INTERVIEW_RECOMMENDATION_LABEL[evaluation.recommendation]}
                    </Badge>
                    {evaluation.average !== null && <span className="text-label text-fg-muted">média {evaluation.average}</span>}
                  </div>
                  {evaluation.comment && <p className="mt-2 whitespace-pre-wrap break-words text-body text-fg">{evaluation.comment}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {groups !== null && groups.length === 0 && canEvaluate && (
          <p className="text-body text-fg-muted">Ninguém preencheu a ficha desta entrevista ainda.</p>
        )}
      </CardBody>
    </Card>
  );
}
