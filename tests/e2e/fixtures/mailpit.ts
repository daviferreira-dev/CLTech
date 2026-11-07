// Lê o e-mail recebido no Mailpit local (docker, porta 8025) — só para os specs de e-mail.
const MAILPIT_URL = process.env.MAILPIT_URL || "http://localhost:8025";

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

/** Espera (poll) o e-mail mais recente para `to` com o assunto pedido e devolve o texto puro. */
export async function waitForMail(to: string, subject: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const body = (await res.json()) as { messages: MailpitMessage[] };
    const match = body.messages.find((m) => m.Subject === subject);
    if (match) {
      const full = await (await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`)).json();
      return full.Text as string;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nenhum e-mail com assunto "${subject}" chegou para ${to} em ${timeoutMs}ms.`);
}

/** Espera um e-mail para `to` cujo texto contém `needle` (quando o assunto depende do modelo da vaga). */
export async function waitForMailContaining(to: string, needle: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const body = (await res.json()) as { messages: MailpitMessage[] };
    for (const message of body.messages) {
      const full = await (await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json();
      if ((full.Text as string).includes(needle)) return full.Text as string;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nenhum e-mail com "${needle}" chegou para ${to} em ${timeoutMs}ms.`);
}

export function linkFrom(text: string, pathSegment: string): string {
  const match = text.match(new RegExp(`https?://\\S*${pathSegment}\\S*`));
  if (!match) throw new Error(`Nenhum link com "${pathSegment}" no e-mail:\n${text}`);
  return match[0];
}
