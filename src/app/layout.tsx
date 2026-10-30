import type { Metadata } from "next";
import { JetBrains_Mono, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_SCRIPT } from "@/lib/csp";

// Fontes servidas pelo próprio app (next/font baixa no build): nenhuma requisição externa em runtime.
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Outfit({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

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
