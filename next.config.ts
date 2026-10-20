import type { NextConfig } from "next";

// Spec 006, FR-304 / L4 (CT-RNF05 passo 1). A plataforma de deploy redireciona HTTP para
// HTTPS, mas sem HSTS o primeiro acesso de cada navegador ainda pode sofrer downgrade.
// Exportado para o teste de auditoria conferir a lista sem subir o servidor.
export const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
