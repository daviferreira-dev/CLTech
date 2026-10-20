import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { listMyChallenges } from "@/server/code-test/session";
import { toErrorResponse } from "@/lib/errors";

// Spec 005 US2.1: desafios pendentes do próprio candidato.
export async function GET() {
  try {
    const user = await requireRole(["CANDIDATE"]);
    return NextResponse.json({ items: await listMyChallenges(user.id) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
