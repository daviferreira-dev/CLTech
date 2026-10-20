import { requirePageRole, CANDIDATE_ROLES, currentPath, type PageSearchParams } from "@/lib/guards";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requirePageRole(CANDIDATE_ROLES, currentPath("/perfil", await searchParams));

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <h1 className="text-2xl font-semibold">Meu Perfil</h1>
      <ProfileForm />
    </div>
  );
}
