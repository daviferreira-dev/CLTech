/**
 * Só aceita destino interno (`/algo`), nunca `//host` nem URL absoluta — `?next=` e
 * `callbackUrl` vêm da query e não podem virar redirecionamento aberto.
 */
export function safeInternalPath(value: string | string[] | undefined | null): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}
