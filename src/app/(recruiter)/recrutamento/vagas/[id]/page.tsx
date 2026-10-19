import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { JobBuilder } from "@/components/recruiter/JobBuilder";

export default async function EditarVagaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/entrar");
  if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") redirect("/vagas");

  const { id } = await params;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-6 text-xl font-semibold sm:text-2xl">Editar Vaga</h1>
      <JobBuilder jobId={id} />
    </div>
  );
}
