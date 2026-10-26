// E-mail "você passou de etapa" / "você foi aprovado" (RN005).
// Princípio I (research.md R11): leva nome, vaga e etapa — nunca score, currículo ou GitHub.
import type { MailMessage } from "../mailer";
import { COLOR, FONT, escapeHtml, firstName, joinUrl, renderEmailLayout, stageLabel } from "./layout";

// O que o candidato faz (ou espera) na etapa em que acabou de entrar.
const NEXT_STEP: Record<string, { text: string; cta: string; path: string }> = {
  RESUME_ANALYSIS: { text: "Seu currículo está em análise. Assim que houver novidade, avisamos por aqui.", cta: "Acompanhar candidatura", path: "/candidaturas" },
  CODE_TEST: {
    text: "Seu teste de código já está liberado. Reserve um tempo tranquilo para fazê-lo: a tentativa é única e o resultado sai na hora.",
    cta: "Fazer o teste de código",
    path: "/desafios",
  },
  GITHUB_ANALYSIS: { text: "Agora vamos olhar seus repositórios públicos no GitHub. Não precisa fazer nada — só manter o perfil vinculado.", cta: "Acompanhar candidatura", path: "/candidaturas" },
  HR_INTERVIEW: { text: "O time de RH vai entrar em contato para agendar uma conversa com você. Fique de olho no e-mail e no telefone.", cta: "Acompanhar candidatura", path: "/candidaturas" },
  TECH_INTERVIEW: { text: "Próximo passo: entrevista técnica com o time. Entraremos em contato para combinar o melhor horário.", cta: "Acompanhar candidatura", path: "/candidaturas" },
  FINAL_OFFER: { text: "Você chegou à etapa final! Em breve você recebe os detalhes da proposta.", cta: "Acompanhar candidatura", path: "/candidaturas" },
};

export interface StageAdvancedEmailInput {
  to: string;
  candidateName: string;
  jobTitle: string;
  /** Todas as etapas da vaga, em ordem. */
  stages: Array<{ type: string; order: number }>;
  /** Etapa em que o candidato entrou; `null` quando avançar da última etapa o aprovou. */
  newStageOrder: number | null;
  /** Reunião marcada pelo recrutador (entrevistas). */
  meeting?: { at: Date; url: string };
  appUrl: string;
}

// Linha do tempo vertical: concluída (✓ verde), atual (anel verde), próximas (cinza).
function renderTimeline(stages: StageAdvancedEmailInput["stages"], currentOrder: number | null): string {
  const rows = stages
    .map((stage, i) => {
      const done = currentOrder === null || stage.order < currentOrder;
      const current = stage.order === currentOrder;
      const isLast = i === stages.length - 1;

      const dot = done
        ? `<div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:${COLOR.accent};color:#FFFFFF;font-size:13px;font-weight:700;text-align:center;">&#10003;</div>`
        : current
          ? `<div style="width:18px;height:18px;border-radius:12px;border:3px solid ${COLOR.accent};background:${COLOR.accentSoft};"></div>`
          : `<div style="width:20px;height:20px;border-radius:12px;border:2px solid ${COLOR.border};background:${COLOR.surface};"></div>`;
      const line = isLast
        ? ""
        : `<div style="width:2px;height:18px;margin:2px auto 0;background:${done ? COLOR.accent : COLOR.border};"></div>`;
      const labelStyle = current
        ? `color:${COLOR.ink};font-weight:700;`
        : done
          ? `color:${COLOR.inkSoft};`
          : `color:${COLOR.inkMuted};`;
      const tag = current
        ? ` <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:10px;background:${COLOR.accentSoft};color:${COLOR.accent};font-size:11px;font-weight:700;letter-spacing:.3px;">VOCÊ ESTÁ AQUI</span>`
        : "";

      return `<tr>
        <td width="24" valign="top" align="center" style="padding:0;">${dot}${line}</td>
        <td valign="top" style="padding:2px 0 0 12px;font-family:${FONT};font-size:14px;line-height:20px;${labelStyle}">${escapeHtml(stageLabel(stage.type))}${tag}</td>
      </tr>`;
    })
    .join("");
  return `<div style="font-size:12px;font-weight:700;letter-spacing:.6px;color:${COLOR.inkMuted};margin-bottom:12px;">SEU PROGRESSO</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

function formatMeeting(at: Date): string {
  return at.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

export function stageAdvancedEmail(input: StageAdvancedEmailInput): MailMessage {
  const name = firstName(input.candidateName);
  const approved = input.newStageOrder === null;
  const newStage = approved ? null : input.stages.find((s) => s.order === input.newStageOrder);
  const next = newStage ? (NEXT_STEP[newStage.type] ?? NEXT_STEP.RESUME_ANALYSIS) : null;
  const ctaHref = joinUrl(input.appUrl, next?.path ?? "/candidaturas");
  const ctaLabel = next?.cta ?? "Ver minha candidatura";
  const job = escapeHtml(input.jobTitle);
  const meetingWhen = input.meeting ? formatMeeting(input.meeting.at) : null;
  const meetingText = input.meeting ? `Reunião marcada para ${meetingWhen} (horário de Brasília). Link: ${input.meeting.url}` : null;

  // Reunião em destaque, com o link clicável; o highlight do layout só aceita texto simples.
  const meetingBlock = input.meeting
    ? `<div style="margin-bottom:20px;padding:14px 16px;border:1px solid ${COLOR.border};border-radius:8px;background:${COLOR.surface};font-family:${FONT};font-size:14px;line-height:22px;color:${COLOR.ink};">
        <div style="font-size:12px;font-weight:700;letter-spacing:.6px;color:${COLOR.inkMuted};margin-bottom:6px;">REUNIÃO MARCADA</div>
        <div><strong>${escapeHtml(meetingWhen!)}</strong> (horário de Brasília)</div>
        <div><a href="${escapeHtml(input.meeting.url)}" style="color:${COLOR.accent};word-break:break-all;">${escapeHtml(input.meeting.url)}</a></div>
      </div>`
    : "";

  const subject = approved
    ? `Você foi aprovado(a) na vaga ${input.jobTitle}! 🎉`
    : `Você avançou para ${stageLabel(newStage!.type)} — ${input.jobTitle}`;

  const html = renderEmailLayout({
    subject,
    preheader: approved ? "Você foi aprovado(a)! Veja os próximos passos." : `Nova etapa: ${stageLabel(newStage!.type)}. Veja o que vem agora.`,
    headline: approved ? `Parabéns, ${name}!` : `Boa notícia, ${name}!`,
    intro: approved
      ? `Você foi <strong>aprovado(a)</strong> no processo seletivo da vaga <strong>${job}</strong>. Foi uma jornada e tanto — obrigado por cada etapa.`
      : `Você passou para a próxima etapa do processo seletivo da vaga <strong>${job}</strong>.`,
    highlight: approved
      ? { tone: "success", eyebrow: "RESULTADO", title: "Aprovado(a) 🎉", text: "O time de recrutamento vai entrar em contato com os próximos passos da contratação." }
      : { tone: "success", eyebrow: "NOVA ETAPA", title: stageLabel(newStage!.type), text: next!.text },
    section: `${meetingBlock}${renderTimeline(input.stages, approved ? null : input.newStageOrder)}`,
    cta: { label: ctaLabel, href: ctaHref },
  });

  const text = [
    approved ? `Parabéns, ${name}!` : `Boa notícia, ${name}!`,
    "",
    approved
      ? `Você foi aprovado(a) no processo seletivo da vaga ${input.jobTitle}. O time de recrutamento vai entrar em contato com os próximos passos da contratação.`
      : `Você passou para a próxima etapa da vaga ${input.jobTitle}: ${stageLabel(newStage!.type)}.\n${next!.text}${meetingText ? `\n${meetingText}` : ""}`,
    "",
    "Seu progresso:",
    ...input.stages.map((s) => {
      const mark = approved || s.order < input.newStageOrder! ? "[x]" : s.order === input.newStageOrder ? "[>]" : "[ ]";
      return `  ${mark} ${stageLabel(s.type)}`;
    }),
    "",
    `${ctaLabel}: ${ctaHref}`,
    "",
    "— CLTech",
  ].join("\n");

  return { to: input.to, subject, html, text };
}
