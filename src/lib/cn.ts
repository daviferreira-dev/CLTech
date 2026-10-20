/** Junta classes condicionais sem dependência externa (NFR-003 da spec 003). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
