"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DIFFICULTY_LABEL, LANGUAGE_LABEL } from "@/lib/codeTest";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, Button, ButtonLink, Card } from "@/components/ui";
import type { PendingChallengeItem } from "@/server/code-test/session";

const STATE: Record<PendingChallengeItem["state"], { label: string; variant: "neutral" | "warning" | "success" | "muted" }> = {
  NOT_STARTED: { label: "Não iniciado", variant: "neutral" },
  IN_PROGRESS: { label: "Em resolução", variant: "warning" },
  SUBMITTED: { label: "Submetido", variant: "success" },
  NOT_CONFIGURED: { label: "Aguardando a empresa", variant: "muted" },
};

export function ChallengeList({ items }: { items: PendingChallengeItem[] }) {
  const router = useRouter();
  const [starting, setStarting] = useState<PendingChallengeItem | null>(null);

  return (
    <>
      <ul className="space-y-4">
        {items.map((item) => {
          const state = STATE[item.state];
          return (
            <Card as="li" key={item.applicationId} className="space-y-3 p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <h2 className="break-words text-h3 text-fg">{item.challengeTitle ?? "Desafio técnico"}</h2>
                  <p className="text-body text-fg-muted">
                    {item.job.title} · {item.job.company}
                  </p>
                </div>
                <Badge variant={state.variant}>{state.label}</Badge>
              </div>
              {item.state !== "NOT_CONFIGURED" && (
                <p className="text-body text-fg-muted">
                  {item.difficulty && `${DIFFICULTY_LABEL[item.difficulty] ?? item.difficulty} · `}
                  {item.timeLimitMinutes} minutos
                  {item.languages.length > 0 && ` · ${item.languages.map((l) => LANGUAGE_LABEL[l] ?? l).join(", ")}`}
                </p>
              )}
              <div>
                {item.state === "NOT_STARTED" && <Button onClick={() => setStarting(item)}>Começar desafio</Button>}
                {item.state === "IN_PROGRESS" && <ButtonLink href={`/desafios/${item.applicationId}`}>Continuar desafio</ButtonLink>}
                {item.state === "SUBMITTED" && (
                  <ButtonLink href={`/desafios/${item.applicationId}`} variant="secondary">
                    Ver submissão
                  </ButtonLink>
                )}
                {item.state === "NOT_CONFIGURED" && (
                  <p className="text-body text-fg-muted">O desafio desta etapa ainda não foi configurado. Volte mais tarde.</p>
                )}
              </div>
            </Card>
          );
        })}
      </ul>

      <ConfirmDialog
        open={starting !== null}
        title="Começar o desafio agora?"
        description={
          <>
            O cronômetro de <strong>{starting?.timeLimitMinutes} minutos</strong> começa ao abrir e não pausa, nem se você
            fechar a página. Seu código é salvo automaticamente e, se o tempo acabar, o último rascunho salvo é submetido.
            A submissão é única.
          </>
        }
        confirmLabel="Começar agora"
        onCancel={() => setStarting(null)}
        onConfirm={() => {
          const id = starting?.applicationId;
          setStarting(null);
          if (id) router.push(`/desafios/${id}`);
        }}
      />
    </>
  );
}
