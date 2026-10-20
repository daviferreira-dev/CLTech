import { AppShell } from "@/components/layout/AppShell";

// Painel, Minhas Vagas e Candidatos vivem no AppHeader (spec 003 US1.2), que escolhe a
// navegação pelo papel da sessão.
export default function RecrutamentoLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
