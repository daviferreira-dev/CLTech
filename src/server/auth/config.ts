// Auth.js (NextAuth v5) — ver research.md R2 e D10 em ers-divergences.md.
//
// Decisão revista em runtime: R2 previa sessão em banco ("database" strategy)
// para permitir revogação imediata. Na prática, o Auth.js v5 NÃO cria linha em
// Session para o provedor Credentials mesmo com essa estratégia configurada —
// o cookie é emitido, mas auth()/getSession() sempre retorna null porque não há
// token correspondente na tabela. É uma limitação da biblioteca, não um bug do
// código deste projeto (confirmado testando o fluxo oficial via
// /api/auth/csrf + /api/auth/callback/credentials). GitHub/LinkedIn continuam
// usando o adapter normalmente; a estratégia de sessão é global, então a
// correção é usar "jwt" para todos os provedores — ver D10.
//
// Credentials com Argon2id, GitHub obrigatório, LinkedIn opcional (sem
// LINKEDIN_ID o botão simplesmente não aparece, sem quebrar o resto — R2).

import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import { createAdapter } from "@/server/auth/adapter";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import LinkedIn from "next-auth/providers/linkedin";
import { TooManyAttempts, authorizeCredentials } from "@/server/auth/credentials";
import { oauthEmailVerified } from "@/server/auth/oauth-email";
import { clientIp } from "@/server/auth/rate-limit";
import { recordOAuthIdentity } from "@/server/candidates/external-accounts";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "E-mail", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    async authorize(raw, request) {
      try {
        return await authorizeCredentials(raw, clientIp(request.headers));
      } catch (err) {
        // CredentialsSignin chega ao cliente como `code` ("blocked_<minutos>"), não como erro 500.
        if (err instanceof TooManyAttempts) throw Object.assign(new CredentialsSignin(), { code: err.code });
        throw err;
      }
    },
  }),
  GitHub({
    clientId: process.env.GITHUB_ID,
    clientSecret: process.env.GITHUB_SECRET,
    // O GitHub passou a devolver `iss` no callback (RFC 9207). Sem issuer declarado, o
    // @auth/core 0.37 compara com o placeholder "https://authjs.dev" e recusa o login
    // ("unexpected iss response parameter value" → /api/auth/error?error=Configuration).
    issuer: "https://github.com/login/oauth",
    // FR-003: vincula à conta existente pelo e-mail em vez de bloquear com
    // OAuthAccountNotLinked. Seguro só porque o callback signIn exige o e-mail verificado.
    allowDangerousEmailAccountLinking: true,
  }),
];

// LinkedIn exige aprovação externa do produto OIDC (R2) — desligado sem quebrar
// o resto quando as credenciais não estão configuradas.
if (process.env.LINKEDIN_ID && process.env.LINKEDIN_SECRET) {
  providers.push(
    LinkedIn({
      clientId: process.env.LINKEDIN_ID,
      clientSecret: process.env.LINKEDIN_SECRET,
      // Idem GitHub: o signIn exige `email_verified` do OIDC.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: createAdapter(),
  // D10: "jwt", não "database" — ver nota acima. O adapter continua ativo para
  // as tabelas Account/User (necessário para FR-003, vínculo por e-mail).
  session: { strategy: "jwt" },
  // Deploy self-hosted (não Vercel) — Auth.js só confia automaticamente no Host
  // em dev ou na Vercel; em `next start` puro rejeita com UntrustedHost sem isto.
  // B2: seguro porque o next-auth troca a origem da requisição por AUTH_URL/NEXTAUTH_URL
  // quando definida (exigida por scripts/check-env.mjs): o Host enviado não muda callbacks.
  trustHost: true,
  providers,
  pages: {
    signIn: "/entrar",
    // Erros como Configuration chegam em /entrar?error=..., no lugar da página padrão em inglês.
    error: "/entrar",
  },
  callbacks: {
    // FR-003: provedor externo com e-mail já cadastrado vincula à conta existente
    // em vez de criar uma segunda (`allowDangerousEmailAccountLinking`). O Auth.js chama
    // este callback antes de vincular, então aqui se exige o e-mail verificado (A1).
    async signIn({ account, profile }) {
      if (!account || (await oauthEmailVerified(account, profile))) return true;
      return "/entrar?error=EmailNotVerified";
    },
    // Estratégia "jwt": o papel precisa ser carregado no token no login e
    // propagado para a sessão a cada leitura — não há mais `user` vindo do banco
    // em toda chamada de session().
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "CANDIDATE" | "RECRUITER" | "ADMIN" }).role ?? "CANDIDATE";
      }
      // Login ou vínculo OAuth (com sessão ativa, o Auth.js vincula o provedor ao usuário
      // logado): guarda o nome verificado pelo provedor para "Conecte suas contas".
      if (user?.id && account && (account.type === "oauth" || account.type === "oidc")) {
        const name = (profile?.name as string | null | undefined) ?? (profile?.login as string | undefined);
        await recordOAuthIdentity(user.id, account.provider, name).catch(() => {});
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "CANDIDATE" | "RECRUITER" | "ADMIN";
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
