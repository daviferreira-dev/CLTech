"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Revalida a página (server component) quando a aba volta a ficar visível. Atende a
 * spec 004 FR-107 em telas que mudam por ação de outra pessoa — ex.: /candidaturas depois
 * que o recrutador decide — sem polling e sem recarregar a página inteira.
 */
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);
  return null;
}
