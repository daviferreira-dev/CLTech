import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { JobBuilder } from "@/components/recruiter/JobBuilder";

export default async function NovaVagaPage() {
  const session = await auth();
  if (!session?.user) redirect("/entrar");
  if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") redirect("/vagas");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Criar Vaga</h1>
      <JobBuilder />
    </div>
  );
}
