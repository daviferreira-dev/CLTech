// M1 (relatorio-seguranca.md): Content-Security-Policy com nonce por requisição. O App Router
// injeta scripts inline (payload RSC), então hash fixo não basta: o middleware gera o nonce e o
// Next o aplica sozinho nos próprios scripts. 'strict-dynamic' libera os chunks carregados por eles.
// O script do tema vai por hash: com nonce, o navegador esconde o atributo e o React acusa
// diferença na hidratação. tests/unit/security-hardening.test.ts confere o hash.

// Aplica o tema salvo (ou o do sistema) antes da primeira pintura, para não piscar o claro.
export const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;
export const THEME_SCRIPT_HASH = "sha256-30rRU8U4RLb3fKFE+f9dYorAPro9F2c3F21RY61KNuM=";

export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    // Dev: o React usa eval para pilhas e o HMR do Turbopack conversa por WebSocket.
    `script-src 'self' 'nonce-${nonce}' '${THEME_SCRIPT_HASH}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // GSAP e o React escrevem atributos style; next/font injeta <style>.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "frame-src https://vercel.live",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
