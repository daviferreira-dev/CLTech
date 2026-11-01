import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { toErrorResponse, Errors } from "@/lib/errors";
import { requireRole } from "@/server/auth/session";
import { signIn } from "@/server/auth/config";
import { changePassword } from "@/server/auth/password";

// api/me é só do candidato (convenção da matriz de acesso — lgpd-access.test.ts).
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const body = await req.json();
    const { email } = await changePassword(user.id, body);
    // A troca derruba todas as sessões, inclusive esta: um login novo mantém só quem trocou.
    await signIn("credentials", { email, password: body.password, redirect: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return toErrorResponse(Errors.validation(err.issues[0]?.message ?? "Dados inválidos."));
    return toErrorResponse(err);
  }
}
