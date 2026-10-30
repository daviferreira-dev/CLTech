// Template do e-mail de entrevista que o recrutador monta por etapa. Substituição de texto
// puro: quem escapa para HTML é o e-mail (stage-advanced.ts); variável desconhecida fica como está.

export const EMAIL_TEMPLATE_VARIABLES = ["candidato", "vaga", "etapa", "data", "horario", "link"] as const;
export type EmailTemplateValues = Record<(typeof EMAIL_TEMPLATE_VARIABLES)[number], string>;

export const EMAIL_SUBJECT_MAX = 200;
export const EMAIL_BODY_MAX = 5000;

export function fillTemplate(template: string, values: EmailTemplateValues): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? values[key as keyof EmailTemplateValues] : match,
  );
}

/** Data e horário no fuso de Brasília, como o e-mail padrão mostra. */
export function meetingValues(at: Date): Pick<EmailTemplateValues, "data" | "horario"> {
  const timeZone = "America/Sao_Paulo";
  return {
    data: at.toLocaleDateString("pt-BR", { dateStyle: "full", timeZone }),
    horario: at.toLocaleTimeString("pt-BR", { timeStyle: "short", timeZone }),
  };
}
