"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/cn";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Entrada suave dos filhos marcados com `data-reveal` (ou do próprio bloco, sem marcas):
 * sobem 20px e aparecem em sequência quando entram na tela. O conteúdo já vem renderizado
 * do servidor; sem JS ou com movimento reduzido, nada fica escondido.
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
  onScroll = true,
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "ul" | "ol";
  /** false: anima na montagem (topo da página), sem esperar o scroll. */
  onScroll?: boolean;
  stagger?: number;
}) {
  const root = useRef<HTMLElement>(null);
  // As quatro tags aceitas têm a mesma API de ref para o que fazemos aqui.
  const Element = Tag as "div";

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const marked = root.current?.querySelectorAll("[data-reveal]");
        const targets = marked && marked.length > 0 ? marked : root.current;
        // Com scroll, só esconde quando o gatilho dispara (immediateRender: false): até lá o
        // conteúdo fica visível. Na montagem, o rAF não roda em aba oculta e a timeline
        // congelaria os itens invisíveis; o setTimeout (que roda, mesmo atrasado) a conclui.
        const tween = gsap.from(targets, {
          y: 20,
          opacity: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger,
          clearProps: "transform,opacity,visibility",
          ...(onScroll ? { immediateRender: false, scrollTrigger: { trigger: root.current, start: "top 85%", once: true } } : {}),
        });
        if (onScroll) return;
        const fallback = window.setTimeout(() => tween.progress(1), tween.totalDuration() * 1000 + 300);
        return () => window.clearTimeout(fallback);
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <Element ref={root as React.RefObject<HTMLDivElement>} className={cn(className)}>
      {children}
    </Element>
  );
}
