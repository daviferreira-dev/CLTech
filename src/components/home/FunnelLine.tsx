"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Hex } from "./Hex";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// As seis etapas reais do pipeline (STAGE_LABEL), com o que cada uma faz no sistema.
const STAGES = [
  { name: "Análise de Currículo", auto: true, text: "O PDF ou DOCX é lido e comparado com as tecnologias da vaga. Sai uma nota de 0 a 100 com o que foi encontrado e o que falta." },
  { name: "Teste de Código", auto: true, text: "Desafio com tempo, resolvido no navegador e corrigido contra casos visíveis e ocultos. Ninguém da equipe sênior precisa parar para corrigir." },
  { name: "Análise de GitHub", auto: true, text: "Repositórios públicos, linguagens e atividade dos últimos 90 dias. Conta conectada por login vem marcada como verificada." },
  { name: "Entrevista de RH", auto: false, text: "O recrutador agenda pela plataforma e o candidato recebe data e link por e-mail." },
  { name: "Entrevista Técnica", auto: false, text: "A conversa com a equipe técnica já parte do código que o candidato enviou." },
  { name: "Proposta Final", auto: false, text: "A aprovação fecha a vaga. Quem não avançou recebe o retorno sem ficar no vácuo." },
];

export function FunnelLine() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-funnel-head]", {
          y: 24,
          autoAlpha: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 78%" },
        });
        gsap.fromTo(
          "[data-funnel-fill]",
          { scaleY: 0 },
          { scaleY: 1, ease: "none", scrollTrigger: { trigger: "[data-funnel-list]", start: "top 70%", end: "bottom 60%", scrub: 0.6 } },
        );
        gsap.utils.toArray<HTMLElement>("[data-funnel-item]").forEach((item) => {
          gsap.from(item, {
            x: -24,
            autoAlpha: 0,
            duration: 0.6,
            ease: "power3.out",
            scrollTrigger: { trigger: item, start: "top 82%" },
          });
          gsap.from(item.querySelector("[data-hex]"), {
            scale: 0.4,
            rotate: -30,
            duration: 0.6,
            ease: "back.out(2)",
            scrollTrigger: { trigger: item, start: "top 82%" },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="funil-titulo" className="bg-surface">
      <div className="mx-auto grid max-w-content gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-28">
        <div className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <h2 id="funil-titulo" data-funnel-head className="font-display text-[34px] font-semibold leading-[40px] tracking-tight text-brand-900 sm:text-[44px] sm:leading-[48px]">
            Seis postos de inspeção, do currículo à proposta.
          </h2>
          <p data-funnel-head className="max-w-md text-[16px] leading-7 text-ink-600">
            Os três primeiros rodam sozinhos e entregam notas comparáveis. Os três últimos são conversas. Em todos eles, quem
            decide se o candidato avança é uma pessoa.
          </p>
          <div data-funnel-head className="flex flex-wrap gap-2 text-label">
            <span className="rounded-full bg-accent-100 px-3 py-1.5 font-semibold text-accent-900">Automático</span>
            <span className="rounded-full bg-primary-100 px-3 py-1.5 font-semibold text-primary-700">Com a equipe</span>
          </div>
        </div>

        <ol data-funnel-list className="relative space-y-8" aria-label="Etapas do processo seletivo">
          <span aria-hidden="true" className="absolute bottom-6 left-[17px] top-6 w-0.5 bg-brand-100" />
          <span aria-hidden="true" data-funnel-fill className="absolute bottom-6 left-[17px] top-6 w-0.5 origin-top bg-accent-600" />
          {STAGES.map((stage) => (
            <li key={stage.name} data-funnel-item className="relative flex gap-5">
              <Hex state={stage.auto ? "done" : "current"} />
              <div className="min-w-0 space-y-1 pt-1">
                <h3 className="flex flex-wrap items-center gap-2 font-display text-[20px] font-semibold leading-7 text-brand-900">
                  {stage.name}
                  <span
                    className={
                      stage.auto
                        ? "rounded-full bg-accent-100 px-2.5 py-0.5 font-sans text-label font-semibold text-accent-900"
                        : "rounded-full bg-primary-100 px-2.5 py-0.5 font-sans text-label font-semibold text-primary-700"
                    }
                  >
                    {stage.auto ? "Automático" : "Com a equipe"}
                  </span>
                </h3>
                <p className="max-w-xl text-body leading-6 text-ink-600">{stage.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
