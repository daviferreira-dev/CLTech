// FR-006: redirecionamento pós-login decidido no servidor a partir de session.user.role,
// nunca pelo cliente. Toda tela de login (credentials ou OAuth) aponta o callbackUrl
// para cá.
//
// `?via=linkedin`: o login do LinkedIn não traz o link do perfil, então o candidato que
// nunca informou o link cai uma vez no perfil com o campo aberto (?conectar=LINKEDIN).

import { NextResponse } from "next/server";
import { auth } from "@/server/auth/config";
import { destinationForRole } from "@/server/auth/redirect";
import { linkedInLinkMissing } from "@/server/candidates/external-accounts";

export async function GET(req: Request) {
  const session = await auth();
  let destination = session?.user ? destinationForRole(session.user.role) : "/entrar";
  const via = new URL(req.url).searchParams.get("via");
  if (session?.user?.role === "CANDIDATE" && via === "linkedin" && (await linkedInLinkMissing(session.user.id))) {
    destination = "/perfil?conectar=LINKEDIN";
  }
  return NextResponse.redirect(new URL(destination, req.url));
}
