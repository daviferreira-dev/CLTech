import { describe, it, expect } from "vitest";
import { fillTemplate, meetingValues } from "@/lib/emailTemplate";
import { stageAdvancedEmail } from "@/server/email/templates/stage-advanced";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/emailMoments";

const VALUES = { candidato: "Ana", vaga: "Dev", etapa: "Entrevista Técnica", data: "sexta", horario: "14:00", link: "https://meet.x/1" };

describe("fillTemplate", () => {
  it("troca as variáveis conhecidas e deixa as desconhecidas como estão", () => {
    expect(fillTemplate("Oi {{candidato}}, {{ vaga }} em {{data}} {{horario}} {{link}} {{salario}}", VALUES)).toBe(
      "Oi Ana, Dev em sexta 14:00 https://meet.x/1 {{salario}}",
    );
  });

  it("não reinterpreta variáveis que vêm dentro dos valores", () => {
    expect(fillTemplate("{{candidato}}", { ...VALUES, candidato: "{{link}}" })).toBe("{{link}}");
  });

  it("formata data e horário no fuso de Brasília", () => {
    expect(meetingValues(new Date("2026-11-06T17:00:00Z")).horario).toBe("14:00");
  });
});

describe("stageAdvancedEmail com template resolvido", () => {
  const base = {
    to: "ana@example.com",
    candidateName: "Ana <b>",
    jobTitle: "Dev",
    company: "3aq",
    stages: [{ type: "RESUME_ANALYSIS", order: 0 }, { type: "HR_INTERVIEW", order: 1 }],
    newStageOrder: 1,
    meeting: { at: new Date("2026-11-06T17:00:00Z"), url: "https://meet.x/1" },
    appUrl: "http://localhost:3000",
  };

  it("usa assunto e corpo do modelo, com o HTML escapado", () => {
    const mail = stageAdvancedEmail({ ...base, template: { subject: "Entrevista\n{{vaga}}", body: "Oi {{candidato}} <script>x</script>\nàs {{horario}}" } });
    expect(mail.subject).toBe("Entrevista Dev");
    expect(mail.html).toContain("Oi Ana &lt;b&gt; &lt;script&gt;x&lt;/script&gt;<br>às 14:00");
    expect(mail.html).not.toContain("<script>");
    expect(mail.text).toContain("Oi Ana <b> <script>x</script>\nàs 14:00");
  });

  it("com o modelo padrão (não editado pelo RH), o texto não fala em agendar uma reunião já marcada", () => {
    const mail = stageAdvancedEmail({ ...base, template: DEFAULT_EMAIL_TEMPLATES.STAGE_ADVANCED_HR_INTERVIEW });
    expect(mail.subject).toContain("Você avançou para");
    expect(mail.text).toContain("já está marcada");
    expect(mail.text).not.toContain("para agendar");
  });

  it("teste de código: {{prazo}} e {{link_teste}} no corpo do modelo padrão", () => {
    const mail = stageAdvancedEmail({
      ...base,
      stages: [{ type: "RESUME_ANALYSIS", order: 0 }, { type: "CODE_TEST", order: 1 }],
      meeting: undefined,
      codeTestMinutes: 90,
      template: DEFAULT_EMAIL_TEMPLATES.STAGE_ADVANCED_CODE_TEST,
    });
    expect(mail.text).toContain("90 minutos");
    expect(mail.text).toContain("http://localhost:3000/desafios");
  });
});
