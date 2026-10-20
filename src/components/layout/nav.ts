// Itens de navegação por papel (spec 003 US1). Módulo comum, sem "use client": o AppShell
// (servidor) escolhe os itens e o AppHeader (cliente) só os renderiza.
export type HeaderRole = "CANDIDATE" | "RECRUITER" | "ADMIN";

export interface HeaderUser {
  name: string;
  role: HeaderRole;
}

export interface NavItem {
  href: string;
  label: string;
  /** Prefixo que também marca o item como atual (ex.: /vagas/[id] dentro de "Vagas"). */
  matchPrefix?: string;
}

// "Desafios Técnicos" entrou com a spec 005 (antes era item sem rota, proibido pela 004 SC-104).
export const CANDIDATE_NAV: NavItem[] = [
  { href: "/vagas", label: "Vagas Disponíveis", matchPrefix: "/vagas" },
  { href: "/candidaturas", label: "Minhas Candidaturas", matchPrefix: "/candidaturas" },
  { href: "/desafios", label: "Desafios Técnicos", matchPrefix: "/desafios" },
  { href: "/perfil", label: "Meu Perfil", matchPrefix: "/perfil" },
];

export const RECRUITER_NAV: NavItem[] = [
  { href: "/recrutamento", label: "Painel" },
  { href: "/recrutamento/vagas", label: "Minhas Vagas", matchPrefix: "/recrutamento/vagas" },
  { href: "/recrutamento/candidatos", label: "Candidatos", matchPrefix: "/recrutamento/candidatos" },
  { href: "/recrutamento/desafios", label: "Desafios", matchPrefix: "/recrutamento/desafios" },
];

export const VISITOR_NAV: NavItem[] = [{ href: "/vagas", label: "Vagas Disponíveis", matchPrefix: "/vagas" }];

export function navFor(user: HeaderUser | null, candidateExtra: NavItem[] = []): NavItem[] {
  if (!user) return VISITOR_NAV;
  return user.role === "CANDIDATE" ? [...CANDIDATE_NAV, ...candidateExtra] : RECRUITER_NAV;
}
