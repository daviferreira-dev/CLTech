// Usado pelo run.bat antes do build: confere o .env e para com mensagem clara em vez de
// deixar a aplicação subir e quebrar só no login, no upload ou na criptografia.
// AUTH_SECRET e ENCRYPTION_KEY vazias são geradas aqui e gravadas no próprio .env.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_FILE = ".env";

const REQUIRED = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "ENCRYPTION_KEY",
  "GITHUB_ID",
  "GITHUB_SECRET",
  "STORAGE_ENDPOINT",
  "STORAGE_BUCKET",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "NEXTAUTH_URL",
];

const GENERATED = ["AUTH_SECRET", "ENCRYPTION_KEY"];

if (!existsSync(ENV_FILE)) {
  console.error(`[check-env] ${ENV_FILE} não encontrado.`);
  process.exit(1);
}

const lines = readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
const values = new Map();
const lineOf = new Map();
lines.forEach((line, i) => {
  const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (!match) return;
  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  values.set(match[1], value);
  lineOf.set(match[1], i);
});

let changed = false;
for (const key of GENERATED) {
  if (values.get(key)) continue;
  const value = randomBytes(32).toString("base64");
  const entry = `${key}="${value}"`;
  if (lineOf.has(key)) lines[lineOf.get(key)] = entry;
  else lines.push(entry);
  values.set(key, value);
  changed = true;
  console.log(`[check-env] ${key} estava vazia: gerada e gravada no ${ENV_FILE}.`);
}
if (changed) {
  writeFileSync(ENV_FILE, lines.join("\n"), "utf8");
  console.log(`[check-env] Guarde o ${ENV_FILE}: perder a ENCRYPTION_KEY torna os dados cifrados irrecuperáveis.`);
}

const problems = REQUIRED.filter((key) => !values.get(key)).map((key) => `${key} está vazia`);
const encryptionKey = values.get("ENCRYPTION_KEY");
if (encryptionKey && Buffer.from(encryptionKey, "base64").length !== 32) {
  problems.push("ENCRYPTION_KEY não tem 32 bytes em base64 (gere com: openssl rand -base64 32)");
}

if (!values.get("SANDBOX_URL")) {
  console.warn('[check-env] Aviso: SANDBOX_URL vazia. O teste de código não executa nem aceita submissões (use "local" em dev).');
}

if (problems.length > 0) {
  console.error(`[check-env] Configuração incompleta no ${ENV_FILE}:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("[check-env] Veja docs/manual-execucao.md, seção 3.");
  process.exit(1);
}
console.log(`[check-env] ${ENV_FILE} ok.`);
