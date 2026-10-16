import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { CandidateSearch } from "./CandidateSearch";

export default async function CandidatosPage() {
  const session = await auth();
  if (!session?.user) redirect("/entrar");
  if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") redirect("/vagas");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <CandidateSearch />
    </div>
  );
}
