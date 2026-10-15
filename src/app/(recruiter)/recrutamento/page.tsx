import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";

export default async function RecrutamentoPage() {
  const session = await auth();

  if (!session?.user) redirect("/entrar");
  if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") {
    redirect("/vagas");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-16">
      <h1 className="text-2xl font-semibold">Área de Recrutamento</h1>
      <p className="text-slate-600">
        O painel completo (ranking de candidatos, métricas e insights) chega na Sprint 2
        (RF07/RF08). Por enquanto, esta tela confirma apenas que o acesso é restrito a
        Recrutador e Administrador.
      </p>
    </div>
  );
}
