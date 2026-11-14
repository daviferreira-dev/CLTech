// CI: toda tabela nova liga o RLS na própria migration (regra do time; ver CONTRIBUTING).
// Uso: node scripts/check-migration-rls.ts <ref-base>  (ex.: origin/main)
// Confere só as migrations ADICIONADAS desde a base; as antigas ficam como estão. Compara
// commits: migration ainda não commitada não aparece.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// "Nome" mantém a caixa; nome sem aspas o Postgres guarda em minúsculas. Schema é ignorado.
const IDENT = String.raw`(?:(?:"[^"]+"|\w+)\.)?("[^"]+"|\w+)`;
const CREATE = new RegExp(String.raw`\bCREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${IDENT}`, "gi");
const ENABLE = new RegExp(
  String.raw`\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${IDENT}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY`,
  "gi",
);

const name = (raw: string) => (raw.startsWith('"') ? raw.slice(1, -1) : raw.toLowerCase());

/** Tabelas criadas neste SQL sem o `ENABLE ROW LEVEL SECURITY` correspondente. */
export function tablesWithoutRls(sql: string): string[] {
  const code = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
  const enabled = new Set([...code.matchAll(ENABLE)].map((m) => name(m[1]!)));
  return [...code.matchAll(CREATE)].map((m) => name(m[1]!)).filter((t) => !enabled.has(t));
}

function main(base: string | undefined) {
  if (!base) {
    console.error("Uso: node scripts/check-migration-rls.ts <ref-base>");
    process.exit(1);
  }
  // quotePath=false: caminho com acento sai cru, não entre aspas com escapes.
  // --no-renames: migration parecida com uma antiga conta como nova, não como renomeada.
  const args = ["-c", "core.quotePath=false", "diff", "--name-only", "--no-renames", "--diff-filter=A"];
  const added = execFileSync("git", [...args, `${base}...HEAD`, "--", "prisma/migrations"], { encoding: "utf8" })
    .split("\n")
    .filter((file) => file.endsWith("/migration.sql"));

  let failed = false;
  for (const file of added) {
    for (const table of tablesWithoutRls(readFileSync(file, "utf8"))) {
      failed = true;
      console.error(`[rls] ${file}: CREATE TABLE "${table}" sem ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    }
  }
  console.log(`[rls] ${added.length} migration(s) nova(s) conferida(s).`);
  if (failed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2]);
