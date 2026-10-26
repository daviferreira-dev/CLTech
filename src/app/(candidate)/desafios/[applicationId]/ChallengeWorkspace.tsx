"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { CASE_OUTCOME_LABEL, DIFFICULTY_LABEL, LANGUAGE_LABEL, STARTER_CODE } from "@/lib/codeTest";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Field,
  Notice,
  Select,
  focusRing,
} from "@/components/ui";
import type { CandidateChallengeView, RunResponse } from "@/server/code-test/session";

const AUTOSAVE_DELAY_MS = 1500;
const GRADING_POLL_MS = 5000;

type SaveState = "saved" | "dirty" | "saving" | "error";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function ChallengeWorkspace({ initial }: { initial: CandidateChallengeView }) {
  const [view, setView] = useState(initial);
  const [language, setLanguage] = useState(initial.draft.language);
  const [code, setCode] = useState(initial.draft.sourceCode);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState(initial.draft.savedAt);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "danger" | "success"; text: string } | null>(null);

  // FR-206: o prazo é do servidor; o navegador só converte para o próprio relógio.
  const clockOffset = useRef(new Date(initial.serverNow).getTime() - Date.now());
  // Primeiro render usa a hora do servidor, igual no SSR e no cliente (sem divergência de hidratação).
  const [now, setNow] = useState(() => new Date(initial.serverNow).getTime());
  const deadline = new Date(view.deadline).getTime();
  const remainingMs = deadline - now;
  const submitted = view.submission !== null;
  const readOnly = submitted || remainingMs <= 0;

  const latest = useRef({ language, code });
  latest.current = { language, code };
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const result = await apiFetch<CandidateChallengeView>(`/api/me/applications/${initial.applicationId}/code-test`);
    if (result.ok) {
      setView(result.data);
      clockOffset.current = new Date(result.data.serverNow).getTime() - Date.now();
      return result.data;
    }
    return null;
  }, [initial.applicationId]);

  const save = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    const payload = latest.current;
    const result = await apiFetch<{ savedAt: string }>(
      `/api/me/applications/${initial.applicationId}/code-test/draft`,
      jsonInit("PUT", { language: payload.language, sourceCode: payload.code }),
    );
    if (result.ok) {
      // Só marca como salvo se nada mudou enquanto a requisição estava em voo.
      const unchanged = latest.current.code === payload.code && latest.current.language === payload.language;
      setSaveState(unchanged ? "saved" : "dirty");
      setSavedAt(result.data.savedAt);
      return true;
    }
    if (result.status === 401) return false;
    setSaveState("error");
    if (result.error?.code === "TIME_EXPIRED" || result.error?.code === "ALREADY_SUBMITTED") {
      await refresh();
      setNotice({ tone: "info", text: result.error.message });
    }
    return false;
  }, [initial.applicationId, refresh]);

  // Autosave ao parar de digitar (US2.4).
  function scheduleSave() {
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, AUTOSAVE_DELAY_MS);
  }

  // Relógio da tela.
  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => setNow(Date.now() + clockOffset.current), 1000);
    return () => clearInterval(id);
  }, [submitted]);

  // Perto do fim, salva o que estiver pendente; no fim, o servidor submete o último rascunho
  // (RF05-A1) e a tela avisa.
  const flushedNearEnd = useRef(false);
  const expiredHandled = useRef(false);
  useEffect(() => {
    if (submitted) return;
    if (remainingMs <= 10_000 && remainingMs > 0 && !flushedNearEnd.current && saveState === "dirty") {
      flushedNearEnd.current = true;
      save();
    }
    if (remainingMs <= 0 && !expiredHandled.current) {
      expiredHandled.current = true;
      refresh().then(() =>
        setNotice({ tone: "info", text: "O tempo acabou. Seu último rascunho salvo foi submetido automaticamente para correção." }),
      );
    }
  }, [remainingMs, submitted, saveState, save, refresh]);

  // Aviso nativo ao sair com alteração não salva.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (saveState === "dirty" || saveState === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  // Enquanto corrige, consulta o estado sem prender o candidato na tela (US3.1).
  useEffect(() => {
    if (view.submission?.status !== "GRADING") return;
    const id = setInterval(refresh, GRADING_POLL_MS);
    return () => clearInterval(id);
  }, [view.submission?.status, refresh]);

  async function handleRun() {
    if (running || readOnly) return;
    setRunning(true);
    setRunError(null);
    const result = await apiFetch<RunResponse>(
      `/api/me/applications/${initial.applicationId}/code-test/run`,
      jsonInit("POST", { language, sourceCode: code }),
    );
    setRunning(false);
    if (result.ok) {
      setRunResult(result.data);
      setSaveState("saved");
      setView((v) => ({ ...v, testRunCount: result.data.testRunCount, remainingRuns: result.data.remainingRuns }));
      return;
    }
    if (result.status === 401) return;
    if (result.networkError) {
      setRunError(NETWORK_ERROR_MESSAGE);
      return;
    }
    if (result.error?.code === "TEST_RUNS_EXHAUSTED") setView((v) => ({ ...v, remainingRuns: 0 }));
    if (result.error?.code === "TIME_EXPIRED" || result.error?.code === "ALREADY_SUBMITTED") await refresh();
    setRunError(result.error?.message ?? "Não foi possível executar o código.");
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    const result = await apiFetch<CandidateChallengeView>(
      `/api/me/applications/${initial.applicationId}/code-test/submit`,
      jsonInit("POST", { language, sourceCode: code }),
    );
    setSubmitting(false);
    setConfirmSubmit(false);
    if (result.ok) {
      setView(result.data);
      setSaveState("saved");
      setNotice({ tone: "success", text: "Solução submetida. A correção roda em segundo plano — você pode sair desta tela." });
      return;
    }
    if (result.status === 401) return;
    if (result.networkError) {
      setNotice({ tone: "danger", text: NETWORK_ERROR_MESSAGE });
      return;
    }
    // Sandbox fora do ar: o servidor salvou o rascunho antes de recusar a submissão.
    if (result.error?.code === "SANDBOX_UNAVAILABLE") setSaveState("saved");
    await refresh();
    setNotice({ tone: result.error?.code === "ALREADY_SUBMITTED" || result.error?.code === "TIME_EXPIRED" ? "info" : "danger", text: result.error?.message ?? "Não foi possível submeter." });
  }

  function changeLanguage(next: string) {
    // Troca o código inicial só se o candidato ainda não escreveu nada além dele.
    const untouched = code.trim() === (STARTER_CODE[language] ?? "").trim() || code.trim() === "";
    setLanguage(next);
    if (untouched) setCode(STARTER_CODE[next] ?? "");
    scheduleSave();
  }

  // Tab no editor insere espaços em vez de tirar o foco; Esc libera o foco para quem navega por teclado.
  function onEditorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      (e.currentTarget as HTMLTextAreaElement).blur();
      return;
    }
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    const next = `${code.slice(0, selectionStart)}    ${code.slice(selectionEnd)}`;
    setCode(next);
    scheduleSave();
    requestAnimationFrame(() => el.setSelectionRange(selectionStart + 4, selectionStart + 4));
  }

  const lowTime = !readOnly && remainingMs <= 5 * 60_000;
  const statusBadge = !view.submission ? null : view.submission.status === "GRADED" ? (
    <Badge variant="success">Correção concluída</Badge>
  ) : view.submission.status === "FAILED" ? (
    <Badge variant="warning">Correção pendente</Badge>
  ) : (
    <Badge variant="neutral">Correção em andamento</Badge>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={<Breadcrumb items={[{ label: "Desafios Técnicos", href: "/desafios" }, { label: view.challenge.title }]} />}
        title={view.challenge.title}
        subtitle={`${view.job.title} · ${view.job.company} · ${DIFFICULTY_LABEL[view.challenge.difficulty] ?? view.challenge.difficulty}`}
        actions={
          submitted ? (
            statusBadge
          ) : (
            <div
              role="timer"
              aria-live={lowTime ? "polite" : "off"}
              aria-label={`Tempo restante: ${formatRemaining(remainingMs)}`}
              className={cn(
                "rounded-card border px-4 py-2 text-right",
                lowTime ? "border-danger-600/50 bg-danger-600/10" : "border-brand-100 bg-surface",
              )}
            >
              <p className="text-label text-ink-600">Tempo restante</p>
              <p className="font-mono text-h2 tabular-nums text-ink-900">{formatRemaining(remainingMs)}</p>
            </div>
          )
        }
      />

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {submitted && !notice && (
        <Notice
          tone="info"
          title={view.submission?.submittedBy === "TIME_EXPIRED" ? "Submetido automaticamente ao fim do tempo" : "Solução submetida"}
          action={
            <ButtonLink href="/candidaturas" variant="secondary" size="sm">
              Ver minhas candidaturas
            </ButtonLink>
          }
        >
          {view.submission?.status === "GRADED"
            ? "A correção foi concluída e o resultado já está com a equipe de recrutamento. A decisão sobre a próxima etapa é sempre de uma pessoa."
            : "A correção roda em segundo plano. Você não precisa ficar nesta tela."}
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0 space-y-6">
          <Card as="section" aria-labelledby="enunciado">
            <CardHeader titleId="enunciado" title="Enunciado" />
            <CardBody>
              <p className="whitespace-pre-line break-words text-body text-ink-900">{view.challenge.statement}</p>
            </CardBody>
          </Card>
          <Card as="section" aria-labelledby="exemplos">
            <CardHeader
              titleId="exemplos"
              title="Casos de exemplo"
              description={
                view.challenge.hiddenCaseCount > 0
                  ? `Sua solução também será corrigida contra ${view.challenge.hiddenCaseCount} caso(s) oculto(s).`
                  : undefined
              }
            />
            <CardBody className="space-y-3">
              {view.challenge.visibleCases.map((c, i) => (
                <div key={c.index} className="grid gap-2 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-label text-ink-600">Entrada {i + 1}</p>
                    <pre className="overflow-x-auto rounded-field bg-canvas p-2 font-mono text-label font-normal text-ink-900">{c.input || "(vazia)"}</pre>
                  </div>
                  <div className="min-w-0">
                    <p className="text-label text-ink-600">Saída esperada {i + 1}</p>
                    <pre className="overflow-x-auto rounded-field bg-canvas p-2 font-mono text-label font-normal text-ink-900">{c.expectedOutput}</pre>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card as="section" aria-labelledby="editor-titulo">
            <CardHeader
              titleId="editor-titulo"
              title="Sua solução"
              description={readOnly ? "Somente leitura." : "Leia da entrada padrão e escreva na saída padrão."}
              actions={
                <span aria-live="polite" className="text-label font-normal text-ink-600">
                  {readOnly
                    ? null
                    : saveState === "saving"
                      ? "Salvando…"
                      : saveState === "dirty"
                        ? "Alterações não salvas"
                        : saveState === "error"
                          ? "Não foi possível salvar — tentaremos de novo"
                          : `Salvo às ${new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              }
            />
            <CardBody className="space-y-4">
              <Field id="linguagem" label="Linguagem" className="sm:w-60">
                <Select value={language} onChange={(e) => changeLanguage(e.target.value)} disabled={readOnly}>
                  {view.allowedLanguages.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_LABEL[l] ?? l}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="space-y-1.5">
                <label htmlFor="codigo" className="block text-label text-ink-600">
                  Código
                </label>
                <textarea
                  id="codigo"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    scheduleSave();
                  }}
                  onBlur={() => saveState === "dirty" && save()}
                  onKeyDown={onEditorKeyDown}
                  readOnly={readOnly}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-describedby="codigo-dica"
                  rows={20}
                  className={cn(
                    "w-full resize-y rounded-field border border-brand-100 bg-brand-900 p-3 font-mono text-label font-normal leading-5 text-surface",
                    readOnly && "opacity-80",
                    focusRing,
                  )}
                />
                <p id="codigo-dica" className="text-label font-normal text-ink-600">
                  Tab insere espaços; Esc sai do editor.
                </p>
              </div>

              {!readOnly && (
                <div className="flex flex-col gap-3 border-t border-brand-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-body text-ink-600">
                    Execuções de teste restantes: <strong className="text-ink-900">{view.remainingRuns}</strong> de {view.maxTestRuns}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={handleRun} loading={running} disabled={view.remainingRuns <= 0}>
                      {running ? "Executando…" : "Executar testes"}
                    </Button>
                    <Button onClick={() => setConfirmSubmit(true)} disabled={running || submitting}>
                      Submeter solução
                    </Button>
                  </div>
                </div>
              )}
              {runError && <Notice tone="danger">{runError}</Notice>}
            </CardBody>
          </Card>

          {runResult && (
            <Card as="section" aria-labelledby="resultado">
              <CardHeader
                titleId="resultado"
                title="Resultado nos casos de exemplo"
                description={`${runResult.results.filter((r) => r.outcome === "PASSED").length} de ${runResult.results.length} passaram.`}
              />
              <CardBody className="space-y-3">
                <ul className="space-y-3">
                  {runResult.results.map((r, i) => (
                    <li key={r.index} className="space-y-2 rounded-card border border-brand-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-body font-medium text-ink-900">Caso {i + 1}</p>
                        <Badge variant={r.outcome === "PASSED" ? "success" : "danger"}>{CASE_OUTCOME_LABEL[r.outcome]}</Badge>
                      </div>
                      {r.outcome !== "PASSED" && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="min-w-0">
                            <p className="text-label text-ink-600">Saída obtida</p>
                            <pre className="overflow-x-auto rounded-field bg-canvas p-2 font-mono text-label font-normal">{r.actualOutput || "(vazia)"}</pre>
                          </div>
                          <div className="min-w-0">
                            <p className="text-label text-ink-600">Saída esperada</p>
                            <pre className="overflow-x-auto rounded-field bg-canvas p-2 font-mono text-label font-normal">{r.expectedOutput}</pre>
                          </div>
                        </div>
                      )}
                      {r.diagnostics && r.outcome !== "PASSED" && (
                        <pre className="max-h-40 overflow-auto rounded-field bg-danger-600/5 p-2 font-mono text-label font-normal text-ink-900">{r.diagnostics}</pre>
                      )}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        title="Submeter solução?"
        description="A tentativa é única: depois de submeter, o código não pode mais ser alterado e a correção roda contra todos os casos, inclusive os ocultos."
        confirmLabel="Submeter definitivamente"
        loading={submitting}
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={handleSubmit}
      />
    </div>
  );
}
