// A1 (relatorio-seguranca.md): login ou vínculo OAuth só com e-mail verificado pelo provedor.
// O provedor GitHub do Auth.js usa o e-mail primário sem olhar `verified`, e o GitHub aceita
// primário não verificado: bastava pôr o e-mail de um recrutador na conta para entrar como ele.
import type { Account, Profile } from "next-auth";

type GitHubEmail = { email: string; primary: boolean; verified: boolean };

export async function oauthEmailVerified(account: Pick<Account, "provider" | "access_token">, profile?: Profile): Promise<boolean> {
  if (account.provider !== "github" && account.provider !== "linkedin") return true;
  const email = profile?.email?.toLowerCase();
  if (!email) return false;
  // O id_token do LinkedIn manda `email_verified` como string ("true"), não booleano.
  if (account.provider === "linkedin") return String(profile?.email_verified) === "true";

  // O access_token só é usado aqui; o adapter descarta os tokens antes de gravar (stripOAuthTokens).
  if (!account.access_token) return false;
  const res = await fetch("https://api.github.com/user/emails", {
    headers: { Authorization: `Bearer ${account.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "cltech" },
  }).catch(() => null);
  if (!res?.ok) return false;
  const emails = (await res.json()) as GitHubEmail[];
  return emails.some((e) => e.primary && e.verified && e.email.toLowerCase() === email);
}
