// Carrega o ambiente dos testes de integração antes de qualquer import do Prisma Client.
// Roda como primeiro setupFile do projeto "integration" (vitest.workspace.ts); os testes de
// unidade não passam por aqui e não precisam de banco.
//
// setup.ts dá TRUNCATE CASCADE em todas as tabelas de domínio antes de cada teste, então este
// arquivo recusa qualquer configuração que possa apontar para um banco de verdade.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

function parseDotEnv(filePath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!existsSync(filePath)) return vars;
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
    vars[key] = value;
  }
  return vars;
}

/** Usuário + host + nome do banco: o que identifica o banco, sem porta, senha nem parâmetros. */
function databaseIdentity(url: string): string | null {
  try {
    const u = new URL(url);
    return `${decodeURIComponent(u.username)}@${u.hostname}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return null;
  }
}

// `.env.test` (local, não versionado) tem prioridade sobre o template versionado.
const localPath = path.join(root, ".env.test");
const templatePath = path.join(root, ".env.test.example");
const envPath = existsSync(localPath) ? localPath : templatePath;
if (!existsSync(envPath)) {
  throw new Error(
    "Nem `.env.test` nem `.env.test.example` encontrados. Os testes de integração dão " +
      "TRUNCATE em todas as tabelas e precisam de um banco de teste explícito.",
  );
}

// Valores do arquivo de teste vencem o ambiente: um DATABASE_URL exportado no shell (o de
// desenvolvimento, por exemplo) não pode vazar para a suíte que trunca tudo.
// TEST_DATABASE_URL é a válvula para o CI apontar outro banco sem arquivo.
Object.assign(process.env, parseDotEnv(envPath));
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const testUrl = process.env.DATABASE_URL ?? "";
if (!testUrl || testUrl.includes("<")) {
  throw new Error(`\`${path.basename(envPath)}\` não tem um DATABASE_URL utilizável.`);
}

const devUrl = parseDotEnv(path.join(root, ".env")).DATABASE_URL;
if (devUrl && databaseIdentity(devUrl) === databaseIdentity(testUrl)) {
  throw new Error(
    "O DATABASE_URL dos testes aponta para o mesmo banco do `.env`. A suíte dá TRUNCATE em " +
      "todas as tabelas e apagaria esses dados. Use um banco só de teste (ver .env.test.example).",
  );
}
