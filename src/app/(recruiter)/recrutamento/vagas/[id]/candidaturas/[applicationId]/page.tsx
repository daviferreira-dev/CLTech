import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { ApplicationDetailView } from "./ApplicationDetailView";

export default async function CandidaturaDetailPage({
  params,
}: {
  params: Promise<{ id: string; applicationId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/entrar");
  if (session.user.role !== "RECRUITER" && session.user.role !== "ADMIN") redirect("/vagas");

  const { id, applicationId } = await params;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ApplicationDetailView jobId={id} applicationId={applicationId} />
    </div>
  );
}
