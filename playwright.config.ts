import { defineConfig, devices } from "@playwright/test";

// SC-006 / FR-030: os três fluxos P1 precisam passar em 360px (mobile) e 1280px (desktop).
export default defineConfig({
  testDir: "./tests/e2e",
  // Um único server + pool de conexões Supabase compartilhado: alta concorrência
  // (muitos registros com Argon2id em paralelo) estourava o pool e derrubava o
  // signIn logo após o cadastro de forma intermitente. Execução serial aqui.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile-360",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    // Produção, não `pnpm dev`: compilação lazy do dev server corre contra o hidratação do
    // React — clique do Playwright pode acontecer antes do bundle carregar, caindo em
    // submit nativo do HTML (sem `name` nos inputs, vira GET para a própria URL sem dados).
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // Build cold leva ~2m40s neste ambiente — folga generosa acima disso.
    timeout: 300000,
  },
});
