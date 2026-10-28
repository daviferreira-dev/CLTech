import { defineConfig } from "prisma/config";

// Com este arquivo, o Prisma deixa de ler o .env sozinho. Na Vercel não há .env (as variáveis
// já vêm no ambiente), por isso a ausência do arquivo não é erro.
try {
  process.loadEnvFile();
} catch {
  // sem .env: segue com o ambiente atual
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file=.env prisma/seed.ts",
  },
});
