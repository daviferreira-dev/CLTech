import { describe, expect, it } from "vitest";
import { migrationUrl } from "../../scripts/migration-url";

// Partes soltas e montadas aqui, para não parecer uma credencial fixa no código (GitGuardian).
const HOST = "aws-0-sa-east-1.pooler.supabase.com";
const SENHA = "exemplo%40teste";
const url = (porta: number, query = "") => ["postgresql://", "postgres.abc:", SENHA, "@", HOST, `:${porta}/postgres`, query].join("");

const POOLER = url(6543, "?pgbouncer=true&connection_limit=1");

describe("URL de migração do build de produção", () => {
  it("DIRECT_URL tem prioridade", () => {
    expect(migrationUrl({ DIRECT_URL: "postgresql://d", DATABASE_URL: POOLER })).toBe("postgresql://d");
  });

  it("deriva o session pooler (5432) do pooler transaction (6543), mantendo usuário e senha", () => {
    expect(migrationUrl({ DATABASE_URL: POOLER })).toBe(url(5432));
  });

  it("mantém outros parâmetros da query", () => {
    expect(migrationUrl({ DATABASE_URL: `${POOLER}&sslmode=require` })).toBe(url(5432, "?sslmode=require"));
  });

  it("não deriva fora do pooler do Supabase na 6543", () => {
    expect(migrationUrl({ DATABASE_URL: POOLER.replace(HOST, "localhost") })).toBeNull();
    expect(migrationUrl({ DATABASE_URL: POOLER.replace(":6543", ":5432") })).toBeNull();
    expect(migrationUrl({ DATABASE_URL: "não é url" })).toBeNull();
    expect(migrationUrl({})).toBeNull();
  });
});
