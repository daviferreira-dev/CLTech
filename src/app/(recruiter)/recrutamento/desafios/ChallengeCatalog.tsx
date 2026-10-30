"use client";

import { useState } from "react";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { CODE_LANGUAGES, DIFFICULTY_LABEL, LANGUAGE_LABEL, MAX_CASE_TIME_LIMIT_SECONDS, casesLabel } from "@/lib/codeTest";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Notice,
  Select,
  Textarea,
  Markdown,
  Icon,
} from "@/components/ui";
import type { ChallengePublicView } from "@/server/code-test/challenges";

interface CaseDraft {
  input: string;
  expectedOutput: string;
  hidden: boolean;
}

const EMPTY_CASE: CaseDraft = { input: "", expectedOutput: "", hidden: false };

export function ChallengeCatalog({ initial, canCreate }: { initial: ChallengePublicView[]; canCreate: boolean }) {
  const [items, setItems] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [difficulty, setDifficulty] = useState("");
  const [language, setLanguage] = useState("");
  const visible = items.filter((c) => (!difficulty || c.difficulty === difficulty) && (!language || c.languages.includes(language)));

  return (
    <>
      <PageHeader
        breadcrumb={<Breadcrumb items={[{ label: "Painel", href: "/recrutamento" }, { label: "Desafios" }]} />}
        title="Desafios"
        subtitle="Catálogo usado na etapa de teste de código. Casos ocultos nunca são exibidos — nem aqui."
        actions={canCreate && !creating ? <Button onClick={() => setCreating(true)}>Cadastrar desafio</Button> : undefined}
      />

      {creating && (
        <ChallengeForm
          onCancel={() => setCreating(false)}
          onCreated={(challenge) => {
            setItems((prev) => [challenge, ...prev]);
            setCreating(false);
          }}
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum desafio cadastrado."
          description={
            canCreate
              ? "Cadastre o primeiro para que as vagas possam usar a etapa de teste de código."
              : "Peça a um administrador para cadastrar desafios — sem eles, a etapa de teste de código não pode ser publicada."
          }
          action={canCreate && !creating ? <Button onClick={() => setCreating(true)}>Cadastrar desafio</Button> : undefined}
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[repeat(2,minmax(0,14rem))] sm:items-end">
            <Field id="filtro-dificuldade" label="Dificuldade">
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(DIFFICULTY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="filtro-linguagem" label="Linguagem">
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="">Todas</option>
                {CODE_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABEL[l] ?? l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p aria-live="polite" className="mb-3 text-body text-fg-muted">
            {visible.length} {visible.length === 1 ? "desafio" : "desafios"}
            {difficulty || language ? " com os filtros aplicados" : ""}
          </p>
          {visible.length === 0 && (
            <EmptyState
              title="Nenhum desafio com esses filtros."
              action={
                <Button variant="secondary" onClick={() => (setDifficulty(""), setLanguage(""))}>
                  Limpar filtros
                </Button>
              }
            />
          )}
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((challenge) => (
            <Card as="li" key={challenge.id} className="space-y-2 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="break-words text-h3 text-fg">{challenge.title}</h2>
                <Badge variant={challenge.difficulty === "HARD" ? "danger" : challenge.difficulty === "MID" ? "warning" : "success"}>
                  {DIFFICULTY_LABEL[challenge.difficulty]}
                </Badge>
              </div>
              <p className="text-body text-fg-muted">
                {challenge.languages.map((l) => LANGUAGE_LABEL[l] ?? l).join(", ")} · {casesLabel(challenge.visibleCases.length, "visible")} ·{" "}
                {casesLabel(challenge.hiddenCaseCount, "hidden")} · até {challenge.timeLimitSeconds}s por caso
              </p>
              <details className="group">
                <summary className="inline-flex min-h-6 cursor-pointer list-none items-center gap-1 rounded-sm text-body font-medium text-link hover:underline">
                  <Icon name="chevronDown" className="transition-transform group-open:rotate-180" />
                  <span className="group-open:hidden">Ver enunciado</span>
                  <span className="hidden group-open:inline">Ocultar enunciado</span>
                </summary>
                <Markdown source={challenge.statement} className="mt-2 text-fg" />
              </details>
            </Card>
          ))}
        </ul>
        </>
      )}
    </>
  );
}

function ChallengeForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (c: ChallengePublicView) => void }) {
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [difficulty, setDifficulty] = useState("EASY");
  const [languages, setLanguages] = useState<string[]>(["python", "javascript"]);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(String(MAX_CASE_TIME_LIMIT_SECONDS));
  const [cases, setCases] = useState<CaseDraft[]>([{ ...EMPTY_CASE }, { ...EMPTY_CASE, hidden: true }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateCase(index: number, patch: Partial<CaseDraft>) {
    setCases((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const result = await apiFetch<ChallengePublicView>(
      "/api/recruiter/challenges",
      jsonInit("POST", { title, statement, difficulty, languages, timeLimitSeconds: Number(timeLimitSeconds), testCases: cases }),
    );
    setSaving(false);
    if (result.ok) {
      onCreated(result.data);
      return;
    }
    if (result.status === 401) return;
    setError(result.networkError ? NETWORK_ERROR_MESSAGE : (result.error?.message ?? "Não foi possível cadastrar o desafio."));
  }

  return (
    <Card as="section" aria-labelledby="novo-desafio" className="mb-6">
      <CardHeader titleId="novo-desafio" title="Novo desafio" description="Depois que uma vaga usar o desafio, casos de teste, linguagens e tempo não podem mais mudar." />
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field id="desafio-titulo" label="Título">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field id="desafio-enunciado" label="Enunciado" hint="Explique a entrada (stdin) e a saída (stdout) esperadas.">
            <Textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={5} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="desafio-dificuldade" label="Dificuldade">
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="EASY">Fácil</option>
                <option value="MID">Médio</option>
                <option value="HARD">Difícil</option>
              </Select>
            </Field>
            <Field id="desafio-tempo" label={`Tempo por caso (segundos, até ${MAX_CASE_TIME_LIMIT_SECONDS})`}>
              <Input type="number" min={1} max={MAX_CASE_TIME_LIMIT_SECONDS} value={timeLimitSeconds} onChange={(e) => setTimeLimitSeconds(e.target.value)} />
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-label text-fg-muted">Linguagens</legend>
            <div className="flex flex-wrap gap-3">
              {CODE_LANGUAGES.map((language) => (
                <label key={language} className="flex items-center gap-2 text-body text-fg">
                  <input
                    type="checkbox"
                    checked={languages.includes(language)}
                    onChange={(e) => setLanguages((prev) => (e.target.checked ? [...prev, language] : prev.filter((l) => l !== language)))}
                    className="h-4 w-4 accent-action"
                  />
                  {LANGUAGE_LABEL[language]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-label text-fg-muted">Casos de teste</legend>
            {cases.map((c, index) => (
              <div key={index} className="space-y-2 rounded-card border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body font-medium text-fg">Caso {index + 1}</p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-body text-fg">
                      <input type="checkbox" checked={c.hidden} onChange={(e) => updateCase(index, { hidden: e.target.checked })} className="h-4 w-4 accent-action" />
                      Oculto
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => setCases((prev) => prev.filter((_, i) => i !== index))} disabled={cases.length <= 1}>
                      Remover
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field id={`caso-${index}-entrada`} label="Entrada">
                    <Textarea value={c.input} onChange={(e) => updateCase(index, { input: e.target.value })} rows={2} className="font-mono" />
                  </Field>
                  <Field id={`caso-${index}-saida`} label="Saída esperada">
                    <Textarea value={c.expectedOutput} onChange={(e) => updateCase(index, { expectedOutput: e.target.value })} rows={2} className="font-mono" />
                  </Field>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setCases((prev) => [...prev, { ...EMPTY_CASE }])}>
              Adicionar caso
            </Button>
          </fieldset>

          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={saving}>
              Cadastrar desafio
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
