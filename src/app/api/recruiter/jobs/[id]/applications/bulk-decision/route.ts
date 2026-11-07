import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { recordBulkDecision } from "@/server/applications/bulk-decision";
import { bulkDecisionSchema } from "@/lib/validation/applications";
import { toErrorResponse, Errors } from "@/lib/errors";

// Spec 009 (FR-908): avançar ou reprovar até 50 candidaturas da vaga de uma vez.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    const parsed = bulkDecisionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Decisão inválida."));
    }
    const { applicationIds, decision, rejection } = parsed.data;
    return NextResponse.json(await recordBulkDecision(id, user.id, applicationIds, decision, rejection));
  } catch (err) {
    return toErrorResponse(err);
  }
}
