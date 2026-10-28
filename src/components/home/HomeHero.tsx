"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ButtonLink, GitHubIcon, focusRing } from "@/components/ui";
import { cn } from "@/lib/cn";
import { Hex } from "./Hex";

gsap.registerPlugin(useGSAP);

const STATIONS = ["Currículo", "Código", "GitHub", "RH", "Técnica", "Proposta"];
// Exemplo ilustrativo do que o recrutador vê; não é um candidato real.
const SCORES = [
  { label: "Match com a vaga", value: 91, high: true },
  { label: "Teste de código", value: 88, high: true },
  { label: "GitHub", value: 74, high: false },
];

export function HomeHero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro
          .from("[data-hero-line]", { y: 28, autoAlpha: 0, duration: 0.8, stagger: 0.09 })
          .from("[data-hero-card]", { y: 40, autoAlpha: 0, rotate: 1.5, duration: 0.9 }, 0.25);

        // A linha de inspeção: o candidato passa pelos três postos automáticos e para na
        // decisão humana. Repete devagar, como uma esteira.
        const line = gsap.timeline({ repeat: -1, repeatDelay: 2.4, delay: 0.9 });
        line
          .set("[data-step-done]", { scale: 0, autoAlpha: 0 })
          .set("[data-rail-fill]", { scaleX: 0 })
          .set("[data-score-bar]", { scaleX: 0 })
          .set("[data-verdict]", { autoAlpha: 0, y: 8 });
        gsap.utils.toArray<HTMLElement>("[data-score]").forEach((el) => {
          line.set(el, { textContent: "0" }, 0);
        });

        for (let i = 0; i < 3; i++) {
          const at = 0.3 + i * 0.75;
          line.to(`[data-step-done="${i}"]`, { scale: 1, autoAlpha: 1, duration: 0.45, ease: "back.out(2.2)" }, at);
          line.to("[data-rail-fill]", { scaleX: (i + 1) / 5, duration: 0.6, ease: "power2.inOut" }, at);
          line.to(`[data-score-bar="${i}"]`, { scaleX: 1, duration: 0.7, ease: "power2.out" }, at + 0.1);
          line.to(
            `[data-score="${i}"]`,
            { textContent: SCORES[i]!.value, duration: 0.7, ease: "power2.out", snap: { textContent: 1 } },
            at + 0.1,
          );
        }
        line.to("[data-step-current]", { scale: 1.15, duration: 0.3, yoyo: true, repeat: 1, ease: "power1.inOut" }, 2.6);
        line.to("[data-verdict]", { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" }, 2.7);
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden" aria-labelledby="hero-titulo">
      <div className="mx-auto grid max-w-content items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pb-24 lg:pt-20">
        <div className="space-y-7">
          <h1
            id="hero-titulo"
            data-hero-line
            className="font-display text-[40px] font-semibold leading-[44px] tracking-tight text-brand-900 sm:text-[56px] sm:leading-[58px] xl:text-[64px] xl:leading-[64px]"
          >
            Contrate pelo código, não pelo currículo bonito.
          </h1>
          <p data-hero-line className="max-w-xl text-[17px] leading-7 text-ink-600">
            A CLTech lê o currículo, aplica um teste de programação que se corrige sozinho e analisa o GitHub de cada
            candidato. A equipe da 3aq recebe um relatório comparável e decide quem avança.
          </p>
          <div data-hero-line className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/vagas" className="h-12 px-6 text-[15px]">
              Ver vagas abertas
            </ButtonLink>
            <a
              href="/entrar"
              className={cn(
                "inline-flex h-12 items-center gap-2.5 rounded-full bg-[#181717] px-6 text-[15px] font-semibold text-surface transition-colors hover:bg-black",
                focusRing,
              )}
            >
              <GitHubIcon />
              Entrar com GitHub
            </a>
          </div>
          <p data-hero-line className="text-label font-normal text-ink-600">
            Sem instalar nada: inscrição, teste e acompanhamento acontecem no navegador.
          </p>
        </div>

        <figure data-hero-card className="relative mx-auto w-full max-w-[520px]">
          <div aria-hidden="true" className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent-100" />
          <div aria-hidden="true" className="absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-primary-100" />
          <div className="relative space-y-6 rounded-card border border-brand-100 bg-surface p-6 shadow-popover sm:p-7">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-100 text-body font-semibold text-accent-900">LM</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">Larissa M.</p>
                <p className="text-label font-normal text-ink-600">Back-end Pleno · Python, Django, PostgreSQL</p>
              </div>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-label text-ink-600">Exemplo</span>
            </div>

            <div>
              <ol aria-label="Etapas do processo" className="relative grid grid-cols-6">
                <span aria-hidden="true" className="absolute left-[8.33%] right-[8.33%] top-[17px] h-0.5 bg-brand-100" />
                <span
                  aria-hidden="true"
                  data-rail-fill
                  className="absolute left-[8.33%] right-[8.33%] top-[17px] h-0.5 origin-left scale-x-[0.6] bg-accent-600"
                />
                {STATIONS.map((name, i) => (
                  <li key={name} className="relative flex flex-col items-center gap-2">
                    <span className="relative grid place-items-center">
                      <Hex state={i === 3 ? "current" : "todo"} />
                      {i < 3 && (
                        <span data-step-done={i} className="absolute inset-0">
                          <Hex state="done" />
                        </span>
                      )}
                      {i === 3 && <span data-step-current className="absolute inset-0" />}
                    </span>
                    <span className={cn("text-[11px] font-semibold", i === 3 ? "text-primary-700" : "text-ink-600")}>{name}</span>
                  </li>
                ))}
              </ol>
            </div>

            <dl className="space-y-4">
              {SCORES.map((score, i) => (
                <div key={score.label} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
                  <dt className="text-body text-ink-600">{score.label}</dt>
                  <dd className="font-display text-h2 tabular-nums text-brand-900">
                    <span data-score={i}>{score.value}</span>
                    <span className="text-label font-normal text-ink-600"> /100</span>
                  </dd>
                  <div className="col-span-2 h-2 overflow-hidden rounded-full bg-canvas">
                    <div
                      data-score-bar={i}
                      className={cn("h-full origin-left rounded-full", score.high ? "bg-accent-600" : "bg-primary-600")}
                      style={{ width: `${score.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </dl>

            <div data-verdict className="flex items-center justify-between gap-3 rounded-field bg-brand-900 px-4 py-3 text-surface">
              <span className="text-body">Pronta para a Entrevista de RH</span>
              <span className="rounded-full bg-accent-600 px-3 py-1 text-label font-semibold text-brand-900">Decisão da equipe</span>
            </div>
          </div>
          <figcaption className="sr-only">
            Exemplo de relatório: a candidata passou pelas etapas automáticas com notas 91, 88 e 74 e aguarda a decisão do
            recrutador.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
