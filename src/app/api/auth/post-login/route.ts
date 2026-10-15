// FR-006: redirecionamento pós-login decidido no servidor a partir de session.user.role,
// nunca pelo cliente. Toda tela de login (credentials ou OAuth) aponta o callbackUrl
// para cá.

import { NextResponse } from "next/server";
import { auth } from "@/server/auth/config";
import { destinationForRole } from "@/server/auth/redirect";

export async function GET(req: Request) {
  const session = await auth();
  const destination = session?.user ? destinationForRole(session.user.role) : "/entrar";
  return NextResponse.redirect(new URL(destination, req.url));
}
