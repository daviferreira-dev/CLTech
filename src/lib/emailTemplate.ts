// Template de e-mail montado pelo RH — biblioteca (/recrutamento/modelos-de-email) ou texto
// próprio de uma etapa/vaga. Substituição de texto puro: quem escapa para HTML é o e-mail
// (stage-advanced.ts, rejected.ts etc.); variável desconhecida fica como está.

export const EMAIL_SUBJECT_MAX = 200;
export const EMAIL_BODY_MAX = 5000;
export const EMAIL_NAME_MAX = 100;

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => (Object.hasOwn(values, key) ? values[key]! : match));
}

/** Data e horário no fuso de Brasília, como o e-mail padrão mostra. */
export function meetingValues(at: Date): { data: string; horario: string } {
  const timeZone = "America/Sao_Paulo";
  return {
    data: at.toLocaleDateString("pt-BR", { dateStyle: "full", timeZone }),
    horario: at.toLocaleTimeString("pt-BR", { timeStyle: "short", timeZone }),
  };
}
