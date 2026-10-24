// PrismaAdapter com minimização de dados (spec 006, FR-301 / L1).
//
// O adapter padrão grava access_token, refresh_token e id_token do provedor OAuth em
// texto claro na tabela Account. Nenhum código da CLTech usa esses tokens — a coleta do
// GitHub lê só a API pública pelo username (external-accounts.ts). Guardar credencial de
// terceiro sem finalidade fere o art. 6º, III da LGPD, então o vínculo grava apenas o
// necessário para reconhecer o login (FR-003).

import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/** Mantém só os campos que identificam o vínculo; descarta tokens e metadados de sessão OAuth. */
export function stripOAuthTokens(account: AdapterAccount): AdapterAccount {
  const { userId, type, provider, providerAccountId } = account;
  return { userId, type, provider, providerAccountId };
}

export function createAdapter(): Adapter {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    // Primeiro login por OAuth cria o User aqui, sem passar por registerCandidate: o perfil
    // de Candidate (1:1) precisa nascer junto, ou /perfil e a candidatura dão NOT_FOUND.
    createUser: async (data) => {
      const user = await base.createUser!(data);
      await prisma.candidate.create({ data: { userId: user.id } });
      return user;
    },
    linkAccount: (account) => base.linkAccount!(stripOAuthTokens(account)),
  };
}
