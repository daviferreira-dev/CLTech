import { defineConfig } from "vitest/config";
import path from "node:path";

// Configuração base, compartilhada pelos projetos de vitest.workspace.ts:
//   - unit: funções puras, sem banco;
//   - integration: banco de teste real. O ambiente é carregado e validado em
//     tests/integration/env.ts, que recusa rodar contra o banco do `.env`.
export default defineConfig({
  test: {
    environment: "node",
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
