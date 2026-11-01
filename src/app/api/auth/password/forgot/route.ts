import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { toErrorResponse, Errors } from "@/lib/errors";
import { clientIp } from "@/server/auth/rate-limit";
import { requestPasswordReset } from "@/server/auth/password";

// Sempre 202 com o mesmo corpo, exista o e-mail ou não (sem enumeração).
export async function POST(req: NextRequest) {
  try {
    await requestPasswordReset(await req.json(), clientIp(req.headers));
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    if (err instanceof ZodError) return toErrorResponse(Errors.validation(err.issues[0]?.message ?? "Dados inválidos."));
    return toErrorResponse(err);
  }
}
