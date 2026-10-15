import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { registerCandidate } from "@/server/auth/register";
import { signIn } from "@/server/auth/config";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await registerCandidate(body);

    // Autentica imediatamente após o cadastro (contracts/api.md: "201 + sessão criada").
    await signIn("credentials", {
      email: user.email,
      password: body.password,
      redirect: false,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return toErrorResponse(Errors.validation(err.issues[0]?.message ?? "Dados inválidos."));
    }
    return toErrorResponse(err);
  }
}
