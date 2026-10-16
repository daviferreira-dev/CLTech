import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { Dashboard } from "./Dashboard";

export default async function RecrutamentoPage() {
  const session = await auth();

  if (!session?.user) redirect("/entrar");
  if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") {
    redirect("/vagas");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <Dashboard />
    </div>
  );
}
