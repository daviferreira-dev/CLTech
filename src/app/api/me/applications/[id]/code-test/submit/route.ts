import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { submitChallenge } from "@/server/code-test/session";
import { saveDraftSchema } from "@/lib/validation/challenges";
import { toErrorResponse, Errors } from "@/lib/errors";

// Submissão final, única (US2.8–2.9).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const { id } = await params;
    const parsed = saveDraftSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Dados inválidos."));
    }
    return NextResponse.json(await submitChallenge(user.id, id, parsed.data));
  } catch (err) {
    return toErrorResponse(err);
  }
}
