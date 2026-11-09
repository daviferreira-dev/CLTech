// URL que o `prisma migrate deploy` usa no build de produção (ver migrate-production.mjs).
// Prioridade: DIRECT_URL. Sem ela, deriva do DATABASE_URL quando ele é o pooler do Supabase em
// modo transaction (porta 6543), onde a migration pode travar: troca para o session pooler
// (porta 5432, mesmo host, usuário e senha) e tira os parâmetros que só servem ao pgbouncer.
// Devolve null quando não dá para saber a URL certa.
export function migrationUrl(env: { DIRECT_URL?: string; DATABASE_URL?: string }): string | null {
  if (env.DIRECT_URL) return env.DIRECT_URL;
  if (!env.DATABASE_URL) return null;

  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    return null;
  }
  if (!url.hostname.endsWith(".pooler.supabase.com") || url.port !== "6543") return null;

  url.port = "5432";
  url.searchParams.delete("pgbouncer");
  url.searchParams.delete("connection_limit");
  return url.toString();
}
