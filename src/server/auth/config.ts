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

import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import LinkedIn from "next-auth/providers/linkedin";
import * as argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "E-mail", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    async authorize(raw) {
      const parsed = loginSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });
      // FR-004: não revelar se o e-mail existe — mesma resposta genérica (null)
      // tanto para usuário inexistente quanto para senha incorreta.
      if (!user || !user.passwordHash) return null;

      const valid = await argon2.verify(user.passwordHash, password);
      if (!valid) return null;

      return { id: user.id, name: user.name, email: user.email, role: user.role };
    },
  }),
  GitHub({
    clientId: process.env.GITHUB_ID,
    clientSecret: process.env.GITHUB_SECRET,
    // FR-003: vincula à conta existente pelo e-mail em vez de bloquear com
    // OAuthAccountNotLinked. Seguro aqui porque o GitHub verifica o e-mail.
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
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  // D10: "jwt", não "database" — ver nota acima. O adapter continua ativo para
  // as tabelas Account/User (necessário para FR-003, vínculo por e-mail).
  session: { strategy: "jwt" },
  // Deploy self-hosted (não Vercel) — Auth.js só confia automaticamente no Host
  // em dev ou na Vercel; em `next start` puro rejeita com UntrustedHost sem isto.
  trustHost: true,
  providers,
  pages: {
    signIn: "/entrar",
  },
  callbacks: {
    // FR-003: provedor externo com e-mail já cadastrado vincula à conta existente
    // em vez de criar uma segunda. O PrismaAdapter já faz isso automaticamente
    // quando `allowDangerousEmailAccountLinking` é ligado para os provedores OAuth
    // confiáveis que verificam e-mail (GitHub e LinkedIn verificam).
    async signIn() {
      return true;
    },
    // Estratégia "jwt": o papel precisa ser carregado no token no login e
    // propagado para a sessão a cada leitura — não há mais `user` vindo do banco
    // em toda chamada de session().
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "CANDIDATE" | "RECRUITER" | "ADMIN" }).role ?? "CANDIDATE";
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
