import type { NextConfig } from "next";

// Spec 006, FR-304 / L4 (CT-RNF05 passo 1). A plataforma de deploy redireciona HTTP para
// HTTPS, mas sem HSTS o primeiro acesso de cada navegador ainda pode sofrer downgrade.
// Exportado para o teste de auditoria conferir a lista sem subir o servidor.
export const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // M1: o CSP sai por página, com nonce, em src/middleware.ts.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdf-parse usa o pdfjs-dist, que carrega `pdf.worker.mjs` por caminho relativo ao próprio
  // arquivo. Empacotado em .next/server/chunks, o worker não vai junto e TODO PDF caía em
  // parseStatus FAILED ("Setting up fake worker failed"). Fora do bundle, roda do node_modules.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // O rastreio de arquivos do deploy (Vercel) leva o pdf.mjs mas não o worker, carregado por
  // caminho dinâmico: sem isto, em produção todo PDF voltaria a cair em FAILED. O binário
  // nativo do @napi-rs/canvas (Linux na Vercel) vai junto pelo mesmo motivo.
  outputFileTracingIncludes: {
    "/api/me/resume": [
      "./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/.pnpm/@napi-rs+canvas*/node_modules/@napi-rs/**",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
