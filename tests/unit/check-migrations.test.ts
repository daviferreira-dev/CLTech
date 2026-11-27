import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { destructiveStatements, tablesWithoutRls } from "../../scripts/check-migrations";

describe("guarda de RLS nas migrations novas", () => {
  it("migration real com RLS passa", () => {
    const sql = readFileSync("prisma/migrations/20261107085410_avaliacao_rh/migration.sql", "utf8");
    expect(tablesWithoutRls(sql)).toEqual([]);
  });

  it("CREATE TABLE sem RLS falha com o nome da tabela", () => {
    expect(tablesWithoutRls('CREATE TABLE "Foo" ("id" TEXT);')).toEqual(["Foo"]);
  });

  it("RLS de outra tabela não conta", () => {
    const sql = 'CREATE TABLE "Foo" (id int);\nCREATE TABLE "Bar" (id int);\nALTER TABLE "Bar" ENABLE ROW LEVEL SECURITY;';
    expect(tablesWithoutRls(sql)).toEqual(["Foo"]);
  });

  it("RLS em comentário não conta", () => {
    const sql = 'CREATE TABLE "Foo" (id int);\n-- ALTER TABLE "Foo" ENABLE ROW LEVEL SECURITY;\n/* ALTER TABLE "Foo" ENABLE ROW LEVEL SECURITY; */';
    expect(tablesWithoutRls(sql)).toEqual(["Foo"]);
  });

  it("aceita schema, IF NOT EXISTS, ONLY e minúsculas", () => {
    const sql = [
      'create table if not exists "public"."Foo" (id int);',
      "alter table only public.\"Foo\" enable row level security;",
      "CREATE TABLE bar (id int);",
      "ALTER TABLE IF EXISTS BAR ENABLE ROW LEVEL SECURITY;",
    ].join("\n");
    expect(tablesWithoutRls(sql)).toEqual([]);
  });

  it('"Foo" e foo sem aspas são tabelas diferentes no Postgres', () => {
    expect(tablesWithoutRls('CREATE TABLE "Foo" (id int);\nALTER TABLE foo ENABLE ROW LEVEL SECURITY;')).toEqual(["Foo"]);
  });

  it("migration sem CREATE TABLE passa", () => {
    expect(tablesWithoutRls('ALTER TABLE "User" ADD COLUMN "image" TEXT;')).toEqual([]);
  });
});

describe("guarda de migration destrutiva", () => {
  it("nenhuma migration já existente é destrutiva", () => {
    const dirs = readdirSync("prisma/migrations", { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const d of dirs) {
      const sql = readFileSync(`prisma/migrations/${d.name}/migration.sql`, "utf8");
      expect(destructiveStatements(sql), d.name).toEqual([]);
    }
  });

  it.each([
    'DROP TABLE "Foo";',
    'drop table if exists "Foo" cascade;',
    'ALTER TABLE "User" DROP COLUMN "phone";',
    'alter table "User" drop column if exists phone;',
    'ALTER TABLE "User" RENAME COLUMN "phone" TO "tel";',
    'ALTER TABLE "User" RENAME TO "Pessoa";',
    'ALTER TABLE "User" RENAME "phone" TO "tel";',
    "ALTER TYPE \"UserRole\" RENAME VALUE 'ADMIN' TO 'ADM';",
    'ALTER TYPE "UserRole" RENAME TO "UserRole_old";',
    'ALTER TABLE "User" ALTER COLUMN "age" TYPE BIGINT;',
    'ALTER TABLE "User" ALTER COLUMN "age" SET DATA TYPE BIGINT USING "age"::bigint;',
    'alter table "User" alter "age" type bigint;',
    'TRUNCATE "RateLimit";',
    "truncate table rate_limit restart identity;",
    'ALTER TABLE "User" DROP "phone";',
    "alter table only public.users drop if exists phone cascade;",
    'ALTER TABLE "User" ADD COLUMN "tel" TEXT, DROP COLUMN "phone";',
  ])("bloqueia: %s", (sql) => {
    expect(destructiveStatements(sql)).toHaveLength(1);
  });

  it.each([
    'ALTER TABLE "User" ADD COLUMN "image" TEXT;',
    'CREATE TABLE "Foo" ("id" TEXT);',
    "ALTER TYPE \"UserRole\" ADD VALUE 'AUDITOR';",
    'ALTER TABLE "User" ALTER COLUMN "age" DROP NOT NULL;',
    'ALTER TABLE "User" ALTER COLUMN "age" SET DEFAULT 0;',
    'ALTER TABLE "User" DROP CONSTRAINT "User_email_key";',
    'DROP INDEX "User_email_key";',
    'ALTER INDEX "User_old_idx" RENAME TO "User_new_idx";',
    'ALTER TABLE "User" RENAME CONSTRAINT "User_pkey" TO "Pessoa_pkey";',
    'ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";',
    "INSERT INTO \"EmailTemplate\" (\"body\") VALUES ('DROP TABLE x');",
    "COMMENT ON TABLE \"User\" IS 'renamed; DROP COLUMN';",
    'ALTER TABLE "User" ADD COLUMN "rename" TEXT;',
    "ALTER TABLE type ADD COLUMN x int;",
    "INSERT INTO t (a) VALUES ('it''s; TRUNCATE t');",
  ])("deixa passar: %s", (sql) => {
    expect(destructiveStatements(sql)).toEqual([]);
  });

  it("instrução destrutiva só em comentário não conta", () => {
    const sql = '-- DROP TABLE "Foo";\n/* ALTER TABLE "User" DROP COLUMN "x";\nTRUNCATE "Bar"; */\nALTER TABLE "User" ADD COLUMN "y" TEXT;';
    expect(destructiveStatements(sql)).toEqual([]);
  });

  it("-- dentro de string não esconde a instrução seguinte", () => {
    expect(destructiveStatements("SELECT 'a--b'; DROP TABLE x;")).toEqual(["DROP TABLE x"]);
    expect(destructiveStatements("SELECT '/*'; DROP TABLE x; SELECT '*/';")).toEqual(["DROP TABLE x"]);
  });

  it("a mensagem mostra a instrução original, com nomes e sem comentário", () => {
    expect(destructiveStatements('-- tira o telefone\nALTER TABLE "User" DROP "phone"; -- fim')).toEqual([
      'ALTER TABLE "User" DROP "phone"',
    ]);
  });

  it("aprovação dentro de string não vale", () => {
    expect(destructiveStatements("SELECT '\n-- destrutiva-aprovada: x\n'; DROP TABLE x;")).toHaveLength(1);
  });

  it("várias instruções: aponta só as destrutivas, uma por uma", () => {
    const sql = [
      'ALTER TABLE "User" ADD COLUMN "tel" TEXT;',
      'ALTER TABLE "User" DROP COLUMN "phone";',
      'CREATE INDEX "i" ON "User"("tel");',
      'DROP TABLE "Old";',
    ].join("\n");
    expect(destructiveStatements(sql)).toEqual(['ALTER TABLE "User" DROP COLUMN "phone"', 'DROP TABLE "Old"']);
  });

  it("instrução quebrada em várias linhas é uma só", () => {
    expect(destructiveStatements('ALTER TABLE "User"\n  DROP COLUMN\n  "phone";')).toEqual([
      'ALTER TABLE "User" DROP COLUMN "phone"',
    ]);
  });

  it("aprovação com motivo libera a migration inteira, em qualquer caixa", () => {
    expect(destructiveStatements('-- destrutiva-aprovada: coluna sem uso desde o PR #30\nDROP TABLE "Foo";')).toEqual([]);
    expect(destructiveStatements('DROP TABLE "Foo";\n  --  Destrutiva-Aprovada: limpeza')).toEqual([]);
  });

  it("aprovação sem motivo, fora do comentário ou de outra palavra não vale", () => {
    expect(destructiveStatements('-- destrutiva-aprovada:\nDROP TABLE "Foo";')).toHaveLength(1);
    expect(destructiveStatements('-- destrutiva-aprovada:   \nDROP TABLE "Foo";')).toHaveLength(1);
    expect(destructiveStatements('-- aprovada: sim\nDROP TABLE "Foo";')).toHaveLength(1);
    expect(destructiveStatements('DROP TABLE "Foo"; -- destrutiva-aprovada: x')).toHaveLength(1);
  });
});
