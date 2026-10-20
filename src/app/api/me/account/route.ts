import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { deleteMyAccount } from "@/server/candidates/privacy";
import { toErrorResponse } from "@/lib/errors";

// Spec 006, FR-306 — LGPD art. 18, VI: exclusão definitiva da conta do candidato.
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const body = await req.json().catch(() => null);
    await deleteMyAccount(user.id, body?.confirmation);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
