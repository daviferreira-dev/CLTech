import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_SCRIPT } from "@/lib/csp";

// Fontes no repositório (src/app/fonts, Google Fonts, OFL, subset latin, variáveis): o build
// não depende do Google Fonts, que às vezes falha no CI, e nada externo carrega em runtime.
const body = localFont({ src: "./fonts/PlusJakartaSans.woff2", weight: "200 800", variable: "--font-body", display: "swap" });
const display = localFont({ src: "./fonts/Outfit.woff2", weight: "100 900", variable: "--font-display", display: "swap" });
const mono = localFont({ src: "./fonts/JetBrainsMono.woff2", weight: "100 800", variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { template: "%s — CLTech", default: "CLTech — Seleção técnica da 3aq" },
  description: "Plataforma de Seleção Automatizada e Inteligente de Talentos da 3aq Tecnologia.",
};

// CSP com nonce por requisição (src/middleware.ts): página pré-renderizada sairia sem o nonce
// nos scripts do Next, e o navegador os bloquearia.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-page font-sans text-body text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
