// Spec 010 FR-1005: template do resumo diário ao recrutador.
import { describe, expect, it } from "vitest";
import { recruiterDigestEmail, recruiterDigestSubject } from "@/server/email/templates/recruiter-digest";

const base = {
  to: "ana@example.com",
  recruiterName: "Ana Souza",
  stalledDays: 7,
  appUrl: "https://cltech.test/",
  jobs: [
    {
      jobId: "job-1",
      jobTitle: "Backend <Júnior>",
      candidates: [
        { applicationId: "app-1", candidateName: "Carla <script>", stageType: "HR_INTERVIEW", days: 12 },
        { applicationId: "app-2", candidateName: "Diego", stageType: "TECH_INTERVIEW", days: 1 },
      ],
    },
  ],
};

describe("recruiterDigestEmail", () => {
  it("assunto no singular e no plural", () => {
    expect(recruiterDigestSubject(1)).toBe("1 candidato aguardando você");
    expect(recruiterDigestSubject(3)).toBe("3 candidatos aguardando você");
    expect(recruiterDigestEmail(base).subject).toBe("2 candidatos aguardando você");
  });

  it("escapa nome e vaga no HTML e monta o link de cada relatório sem barra dupla", () => {
    const mail = recruiterDigestEmail(base);
    expect(mail.to).toBe("ana@example.com");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("Carla &lt;script&gt;");
    expect(mail.html).toContain("https://cltech.test/recrutamento/vagas/job-1/candidaturas/app-1");
    expect(mail.html).toContain("https://cltech.test/recrutamento");
    expect(mail.text).toContain("Olá, Ana!");
    expect(mail.text).toContain("há mais de 7 dias na mesma etapa");
    expect(mail.text).toContain("Diego · Entrevista técnica · há 1 dia");
  });
});
