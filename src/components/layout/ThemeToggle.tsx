"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon, focusRing } from "@/components/ui";

type Choice = "light" | "dark" | "system";
const NEXT: Record<Choice, Choice> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Choice, string> = { system: "Tema: sistema", light: "Tema: claro", dark: "Tema: escuro" };
const ICON = { system: "monitor", light: "sun", dark: "moon" } as const;

// O script em app/layout.tsx aplica o tema antes de pintar; aqui só se troca e se acompanha o sistema.
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") setChoice(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme = choice === "system" ? (media.matches ? "dark" : "light") : choice;
    };
    apply();
    if (choice !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [choice]);

  function cycle() {
    const next = NEXT[choice];
    setChoice(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABEL[choice]}. Trocar tema`}
      title={LABEL[choice]}
      className={cn("rounded-field p-2 text-fg-muted hover:bg-page hover:text-fg", focusRing)}
    >
      <Icon name={ICON[choice]} className="h-5 w-5" />
    </button>
  );
}
