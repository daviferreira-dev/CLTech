"use client";

// Spec 010 US4: tempo médio em cada etapa de UMA vaga, aberto a partir da visão geral. Reusa
// as métricas do funil do painel (GET /api/recruiter/dashboard?jobId=), sem rota nova.
import { useCallback, useEffect, useState } from "react";
import { STAGE_LABEL } from "@/lib/processStages";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Badge, Button, Icon, Skeleton, textLinkClasses } from "@/components/ui";

interface Funnel {
  avgTimePerStageHours: Array<{ stageType: string; hours: number }>;
  advanceRatePerStage: Array<{ stageType: string; rate: number }>;
  bottleneckStageType: string | null;
}

export function formatHours(hours: number): string {
  if (hours < 1) return "menos de 1h";
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)} dias`;
}

/** `panelId`: a tabela (desktop) e os cartões (mobile) coexistem no DOM — cada um usa o seu. */
export function StageTimesToggle({ panelId, open, onToggle }: { panelId: string; open: boolean; onToggle: () => void }) {
  return (
    // Acima do link que cobre a linha/cartão inteiro (after:absolute inset-0).
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId}
      className={cn(textLinkClasses, "relative z-10 mt-1 inline-flex min-h-6 items-center gap-1 text-label")}
    >
      <Icon name="chevronDown" className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")} />
      Tempo por etapa
    </button>
  );
}

/** `stageOrder`: tipos das etapas na ordem do pipeline da vaga. */
export function StageTimesPanel({
  panelId,
  jobId,
  jobTitle,
  stageOrder,
}: {
  panelId: string;
  jobId: string;
  jobTitle: string;
  stageOrder: string[];
}) {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const result = await apiFetch<{ funnel: Funnel }>(`/api/recruiter/dashboard?jobId=${encodeURIComponent(jobId)}`);
    if (result.ok && Array.isArray(result.data?.funnel?.avgTimePerStageHours)) setFunnel(result.data.funnel);
    else setFailed(true);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  let content: React.ReactNode;
  if (failed) {
    content = (
      <p className="flex flex-wrap items-center gap-2 text-body text-fg-muted">
        Não conseguimos carregar o tempo por etapa.
        <Button variant="ghost" size="sm" onClick={load}>
          Tentar de novo
        </Button>
      </p>
    );
  } else if (!funnel) {
    content = <Skeleton className="h-16 w-full" />;
  } else if (funnel.avgTimePerStageHours.length === 0) {
    content = <p className="text-body text-fg-muted">Ainda sem movimentação suficiente nesta vaga para calcular o tempo por etapa.</p>;
  } else {
    content = (
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={`Tempo por etapa em ${jobTitle}`}>
        {stageOrder.map((stageType, index) => {
          const time = funnel.avgTimePerStageHours.find((item) => item.stageType === stageType);
          const rate = funnel.advanceRatePerStage.find((item) => item.stageType === stageType);
          const isBottleneck = stageType === funnel.bottleneckStageType;
          return (
            <li
              key={`${stageType}-${index}`}
              className={cn("rounded-card border p-3", isBottleneck ? "border-warning/60 bg-warning/5" : "border-line bg-surface")}
            >
              <p className="flex items-center justify-between gap-2 text-body font-medium text-fg">
                {STAGE_LABEL[stageType] ?? stageType}
                {isBottleneck && <Badge variant="warning">Gargalo</Badge>}
              </p>
              <p className="text-label font-normal text-fg-muted">
                {time ? `Tempo médio: ${formatHours(time.hours)}` : "Ninguém saiu desta etapa ainda"}
                {rate ? ` · Avanço: ${Math.round(rate.rate * 100)}%` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    // max-w: na tabela larga (rolagem horizontal), o painel cabe na parte visível sem rolar.
    <div id={panelId} className="relative z-10 max-w-4xl" aria-live="polite">
      {content}
    </div>
  );
}
