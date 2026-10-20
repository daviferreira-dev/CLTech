"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "./Button";

export interface TabItem {
  id: string;
  label: React.ReactNode;
}

/**
 * Abas controladas (padrão WAI-ARIA: setas trocam de aba, Tab sai do grupo). O conteúdo
 * da aba ativa é renderizado pelo chamador dentro de `children`.
 */
export function Tabs({
  items,
  value,
  onChange,
  label,
  children,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  function focusTab(index: number) {
    const next = items[(index + items.length) % items.length];
    if (!next) return;
    onChange(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus();
  }

  return (
    <div className="space-y-4">
      <div ref={listRef} role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-brand-100">
        {items.map((item, index) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              data-tab={item.id}
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") focusTab(index + 1);
                if (e.key === "ArrowLeft") focusTab(index - 1);
              }}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-body font-medium transition-colors",
                selected ? "border-brand-900 text-ink-900" : "border-transparent text-ink-600 hover:text-ink-900",
                focusRing,
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${value}`}>
        {children}
      </div>
    </div>
  );
}
