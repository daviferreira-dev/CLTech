import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { JobsManagerList } from "./JobsManagerList";

export default async function VagasRecrutadorPage() {
  const session = await auth();
  if (!session?.user) redirect("/entrar");
  if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") redirect("/vagas");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <JobsManagerList />
    </div>
  );
}
