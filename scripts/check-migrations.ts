// CI: confere as migrations ADICIONADAS no PR (regras do time; ver .github/CONTRIBUTING.md).
//   1. Toda tabela nova liga o RLS na própria migration.
//   2. Nada destrutivo (DROP TABLE, DROP COLUMN, RENAME, ALTER COLUMN ... TYPE, TRUNCATE) sem
//      a linha `-- destrutiva-aprovada: <motivo>` na migration.
// Uso: node scripts/check-migrations.ts <ref-base>  (ex.: origin/main)
// As antigas ficam como estão. Compara commits: migration ainda não commitada não aparece.
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

// Lê o SQL da esquerda para a direita: o que abre primeiro (string, identificador ou comentário)
// vale, então `--` ou `;` dentro de 'texto' não confundem. Tudo mantém o tamanho, para as
// posições baterem entre as versões:
//   text      comentários em branco (o que se mostra na mensagem)
//   code      e o conteúdo das strings trocado por _ (base da guarda de RLS, que lê os nomes)
//   masked    e também o conteúdo dos "identificadores" (base da guarda destrutiva)
//   approval  strings e identificadores mascarados, comentários mantidos
// ponytail: não entende $$...$$ (corpo de função ou DO) nem E'...\'...'; migration do Prisma
// não usa. Se aparecer, o conteúdo conta como código: pode dar falso positivo, nunca esconde.
const TOKEN = /'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g;
function scan(sql: string) {
  let text = "", code = "", masked = "", approval = "", last = 0;
  for (const m of sql.matchAll(TOKEN)) {
    const gap = sql.slice(last, m.index);
    const t = m[0];
    const blank = " ".repeat(t.length);
    const hidden = t[0] + "_".repeat(t.length - 2) + t[0];
    text += gap + (t[0] === "'" || t[0] === '"' ? t : blank);
    code += gap + (t[0] === "'" ? hidden : t[0] === '"' ? t : blank);
    masked += gap + (t[0] === "'" || t[0] === '"' ? hidden : blank);
    approval += gap + (t[0] === "'" || t[0] === '"' ? hidden : t);
    last = m.index + t.length;
  }
  const rest = sql.slice(last);
  return { text: text + rest, code: code + rest, masked: masked + rest, approval: approval + rest };
}

/** Tabelas criadas neste SQL sem o `ENABLE ROW LEVEL SECURITY` correspondente. */
export function tablesWithoutRls(sql: string): string[] {
  const { code } = scan(sql);
  const enabled = new Set([...code.matchAll(ENABLE)].map((m) => name(m[1]!)));
  return [...code.matchAll(CREATE)].map((m) => name(m[1]!)).filter((t) => !enabled.has(t));
}

// Instrução inteira. RENAME de índice ou de constraint (o Prisma gera ao renomear modelo) não
// mexe em dado nem no que o código lê, por isso só ALTER TYPE ... RENAME (tipo ou valor de enum).
const STATEMENT = [/^DROP\s+TABLE\b/i, /^TRUNCATE\b/i, /^ALTER\s+TYPE\b.*\bRENAME\b/i];
// Ações de ALTER TABLE, separadas por vírgula. COLUMN é opcional no Postgres.
const ALTER_TABLE = /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:(?:"[^"]+"|\w+)\.)?(?:"[^"]+"|\w+)\s*\*?/i;
const ACTION = [
  /^DROP\s+(?!CONSTRAINT\b)/i,
  /^RENAME\b(?!\s+CONSTRAINT\b)/i,
  /^ALTER\s+(?:COLUMN\s+)?(?:"[^"]+"|\w+)\s+(?:SET\s+DATA\s+)?TYPE\b/i,
];
// O motivo fica na mesma linha: [ \t], não \s, para a instrução de baixo não contar como motivo.
const APPROVED = /^[ \t]*--[ \t]*destrutiva-aprovada:[ \t]*\S/im;

function isDestructive(stmt: string): boolean {
  if (STATEMENT.some((re) => re.test(stmt))) return true;
  const head = ALTER_TABLE.exec(stmt);
  if (!head) return false;
  return stmt
    .slice(head[0].length)
    .split(",")
    .some((action) => ACTION.some((re) => re.test(action.trim())));
}

/** Instruções destrutivas deste SQL, a menos que ele traga `-- destrutiva-aprovada: <motivo>`. */
export function destructiveStatements(sql: string): string[] {
  const { text, masked, approval } = scan(sql);
  if (APPROVED.test(approval)) return [];
  const found: string[] = [];
  let pos = 0;
  for (const part of masked.split(";")) {
    const stmt = part.replace(/\s+/g, " ").trim();
    if (isDestructive(stmt)) found.push(text.slice(pos, pos + part.length).replace(/\s+/g, " ").trim());
    pos += part.length + 1;
  }
  return found;
}

const REGRA_DESTRUTIVA = `
Regra: migration só ADICIONA (tabela, coluna, índice). Apagar, renomear, trocar o tipo ou esvaziar
vai numa rodada seguinte, num PR à parte, depois que o código no ar já não usa o que sai. O build
de produção aplica a migration antes de o código novo subir, e o Prisma não desfaz migration.
Se for mesmo necessário: rode antes um backup (Actions -> Backup do banco -> Run workflow) e
ponha na migration a linha  -- destrutiva-aprovada: <motivo>
Ver docs/incidente.md.`;

function main(base: string | undefined) {
  if (!base) {
    console.error("Uso: node scripts/check-migrations.ts <ref-base>");
    process.exit(1);
  }
  // quotePath=false: caminho com acento sai cru, não entre aspas com escapes.
  // --no-renames: migration parecida com uma antiga conta como nova, não como renomeada.
  const args = ["-c", "core.quotePath=false", "diff", "--name-only", "--no-renames", "--diff-filter=A"];
  const added = execFileSync("git", [...args, `${base}...HEAD`, "--", "prisma/migrations"], { encoding: "utf8" })
    .split("\n")
    .filter((file) => file.endsWith("/migration.sql"));

  let failed = false;
  let destructive = false;
  for (const file of added) {
    const sql = readFileSync(file, "utf8");
    for (const table of tablesWithoutRls(sql)) {
      failed = true;
      console.error(`[rls] ${file}: CREATE TABLE "${table}" sem ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    }
    for (const stmt of destructiveStatements(sql)) {
      failed = destructive = true;
      console.error(`[destrutiva] ${file}: ${stmt.slice(0, 160)}`);
    }
  }
  if (destructive) console.error(REGRA_DESTRUTIVA);
  console.log(`[migrations] ${added.length} migration(s) nova(s) conferida(s).`);
  if (failed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2]);
