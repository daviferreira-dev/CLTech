import type { Metadata } from "next";
import { JetBrains_Mono, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Fontes servidas pelo próprio app (next/font baixa no build): nenhuma requisição externa em runtime.
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Outfit({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "CLTech — Portal de Recrutamento",
  description: "Plataforma de Seleção Automatizada e Inteligente de Talentos da 3aq Tecnologia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body className="bg-canvas font-sans text-body text-ink-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
