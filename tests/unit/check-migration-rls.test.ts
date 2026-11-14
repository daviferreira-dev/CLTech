import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tablesWithoutRls } from "../../scripts/check-migration-rls";

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
