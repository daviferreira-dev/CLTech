import type { DefaultSession } from "next-auth";

type Role = "CANDIDATE" | "RECRUITER" | "ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      /** Login (ms); sessão anterior à última troca de senha não vale — session.ts. */
      authAt?: number;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
  }
}
