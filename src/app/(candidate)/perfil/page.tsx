import { redirect } from "next/navigation";
import { auth } from "@/server/auth/config";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/entrar?callbackUrl=/perfil");
  if (session.user.role !== "CANDIDATE") redirect("/recrutamento");

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <h1 className="text-2xl font-semibold">Meu Perfil</h1>
      <ProfileForm />
    </div>
  );
}
