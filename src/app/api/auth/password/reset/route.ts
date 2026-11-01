import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { toErrorResponse, Errors } from "@/lib/errors";
import { clientIp } from "@/server/auth/rate-limit";
import { resetPassword } from "@/server/auth/password";

export async function POST(req: NextRequest) {
  try {
    await resetPassword(await req.json(), clientIp(req.headers));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return toErrorResponse(Errors.validation(err.issues[0]?.message ?? "Dados inválidos."));
    return toErrorResponse(err);
  }
}
