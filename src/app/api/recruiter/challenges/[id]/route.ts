import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { getChallenge, updateChallenge } from "@/server/code-test/challenges";
import { updateChallengeSchema } from "@/lib/validation/challenges";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    return NextResponse.json(await getChallenge(id));
  } catch (err) {
    return toErrorResponse(err);
  }
}

// US4.2: desafio em uso não muda casos de teste (CHALLENGE_IN_USE).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["ADMIN"]);
    const { id } = await params;
    const parsed = updateChallengeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Dados inválidos."));
    }
    return NextResponse.json(await updateChallenge(id, parsed.data));
  } catch (err) {
    return toErrorResponse(err);
  }
}
