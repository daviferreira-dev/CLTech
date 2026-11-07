"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

const SIZE = {
  sm: { cls: "h-8 w-8 text-label", px: 32 },
  md: { cls: "h-10 w-10 text-body", px: 40 },
  lg: { cls: "h-16 w-16 text-h2", px: 64 },
};

/**
 * Foto do GitHub/LinkedIn quando houver (`src`); senão, ou se a URL quebrar (a do LinkedIn
 * expira), as iniciais. Decorativo: o nome sempre aparece ao lado ou em texto para leitor de tela.
 */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const { cls, px } = SIZE[size];
  if (src && broken !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto externa pequena; o otimizador do Next não ajuda aqui
      <img
        src={src}
        alt=""
        width={px}
        height={px}
        referrerPolicy="no-referrer"
        onError={() => setBroken(src)}
        className={cn("shrink-0 rounded-full object-cover", cls, className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-action-soft font-semibold text-link",
        cls,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
