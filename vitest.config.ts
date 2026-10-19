import { defineConfig } from "vitest/config";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Carrega .env.test.example (DATABASE_URL do ambiente de teste — research.md R8) para
// process.env antes de qualquer import do Prisma Client acontecer nos testes.
//
// O arquivo é OBRIGATÓRIO: setup.ts dá TRUNCATE CASCADE em todas as tabelas de domínio
// antes de cada teste. Sem ele o Prisma cairia no DATABASE_URL do .env e a suíte apagaria
// o banco apontado lá sem nenhum aviso.
const envTestPath = path.resolve(__dirname, ".env.test.example");
if (!existsSync(envTestPath)) {
  throw new Error(
    "`.env.test.example` não encontrado. Os testes de integração dão TRUNCATE em todas as " +
      "tabelas — rodar sem ele apagaria o banco apontado pelo `.env`.",
  );
}
loadDotEnv(envTestPath);

// Este arquivo é versionado: enquanto o DATABASE_URL estiver com os placeholders do
// template, falha aqui com mensagem clara em vez de um erro de conexão do Prisma.
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("<")) {
  throw new Error(
    "`.env.test.example` não tem um DATABASE_URL utilizável (ainda está com os placeholders " +
      "`<projeto>`/`<senha>`). Preencha-o antes de rodar `pnpm test`.",
  );
}

function loadDotEnv(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts", "tests/unit/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    hookTimeout: 30000,
    testTimeout: 15000,
    // Testes de integração compartilham um único banco (sem instância efêmera por run) e o
    // beforeEach dá TRUNCATE global — arquivos precisam rodar em série, não em paralelo.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
