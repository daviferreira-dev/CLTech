import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "unit",
      include: ["tests/unit/**/*.test.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "integration",
      include: ["tests/integration/**/*.test.ts"],
      // env.ts primeiro: carrega o DATABASE_URL de teste antes do setup importar o Prisma.
      setupFiles: ["tests/integration/env.ts", "tests/integration/setup.ts"],
    },
  },
]);
