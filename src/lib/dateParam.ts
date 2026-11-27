// Datas vindas da query string (`de`/`ate` da visão geral e do painel). Inválida ou ausente: sem filtro.
export function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
