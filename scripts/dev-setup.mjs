// Prepara o ambiente de desenvolvimento local: Postgres no Docker, currículos em .storage/.
// Uso: pnpm dev:setup (pode rodar de novo quando quiser; nada é duplicado).
//
// 1. Ajusta o .env para o banco local (guarda o anterior em .env.backup na primeira vez);
// 2. sobe o Postgres (docker compose) e espera ficar pronto;
// 3. aplica as migrações no banco de dev e no de teste e roda o seed no de dev.
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ENV_FILE = ".env";
const BACKUP_FILE = ".env.backup";
const DEV_DATABASE_URL = "postgresql://cltech:cltech@localhost:5432/cltech";
const TEST_DATABASE_URL = "postgresql://cltech:cltech@localhost:5432/cltech_test";

const LOCAL_VALUES = {
  DATABASE_URL: DEV_DATABASE_URL,
  STORAGE_ENDPOINT: "local",
  STORAGE_BUCKET: "cltech-curriculos",
  STORAGE_ACCESS_KEY: "local",
  STORAGE_SECRET_KEY: "local",
  NEXTAUTH_URL: "http://localhost:3000",
};
// Só preenchidas se estiverem vazias: não sobrescreve escolha já feita no .env.
const DEFAULTS_IF_EMPTY = {
  SANDBOX_URL: "local",
  GITHUB_ID: "dev-sem-github",
  GITHUB_SECRET: "dev-sem-github",
};
const GENERATED = ["AUTH_SECRET", "ENCRYPTION_KEY"];

function run(command, env = {}) {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, { stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  if (result.status !== 0) {
    console.error(`\n[dev-setup] Falhou: ${command}`);
    process.exit(result.status ?? 1);
  }
}

// --- 1. .env ---
if (!existsSync(ENV_FILE)) {
  copyFileSync(".env.example", ENV_FILE);
  console.log("[dev-setup] .env criado a partir do .env.example.");
} else if (!existsSync(BACKUP_FILE)) {
  copyFileSync(ENV_FILE, BACKUP_FILE);
  console.log(`[dev-setup] .env anterior guardado em ${BACKUP_FILE}.`);
}

const lines = readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
const index = new Map();
const current = new Map();
lines.forEach((line, i) => {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (!match) return;
  index.set(match[1], i);
  current.set(match[1], match[2].replace(/^["']|["']$/g, ""));
});
function set(key, value) {
  const entry = `${key}="${value}"`;
  if (index.has(key)) lines[index.get(key)] = entry;
  else index.set(key, lines.push(entry) - 1);
  current.set(key, value);
}

for (const [key, value] of Object.entries(LOCAL_VALUES)) set(key, value);
for (const [key, value] of Object.entries(DEFAULTS_IF_EMPTY)) if (!current.get(key)) set(key, value);
for (const key of GENERATED) if (!current.get(key)) set(key, randomBytes(32).toString("base64"));
writeFileSync(ENV_FILE, lines.join("\n"), "utf8");
console.log("[dev-setup] .env apontando para o banco local (localhost:5432) e .storage/.");

// --- 2. Postgres ---
run("docker compose up -d --wait postgres");

// --- 3. Migrações e seed ---
run("pnpm exec prisma migrate deploy", { DATABASE_URL: DEV_DATABASE_URL });
run("pnpm exec prisma migrate deploy", { DATABASE_URL: TEST_DATABASE_URL });
run("pnpm db:seed");

console.log("\n[dev-setup] Pronto. Rode `pnpm dev` e abra http://localhost:3000");
