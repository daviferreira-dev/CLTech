import type { Metadata } from "next";
import { JetBrains_Mono, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Fontes servidas pelo próprio app (next/font baixa no build): nenhuma requisição externa em runtime.
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Outfit({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { template: "%s — CLTech", default: "CLTech — Seleção técnica da 3aq" },
  description: "Plataforma de Seleção Automatizada e Inteligente de Talentos da 3aq Tecnologia.",
};

// Aplica o tema salvo (ou o do sistema) antes da primeira pintura, para não piscar o claro.
const themeScript = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-page font-sans text-body text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
