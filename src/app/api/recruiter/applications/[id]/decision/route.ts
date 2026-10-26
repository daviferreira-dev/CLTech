import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { recordDecision } from "@/server/applications/decision";
import { recordDecisionSchema } from "@/lib/validation/applications";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    const body = await req.json();
    const parsed = recordDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Decisão inválida."));
    }
    const result = await recordDecision(id, user.id, parsed.data.decision, parsed.data.meeting);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
