// FR-006: destino pós-autenticação decidido no servidor a partir do papel da sessão.

type Role = "CANDIDATE" | "RECRUITER" | "ADMIN";

export function destinationForRole(role: Role): string {
  return role === "CANDIDATE" ? "/vagas" : "/recrutamento";
}
