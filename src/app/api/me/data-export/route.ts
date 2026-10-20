import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { exportMyData } from "@/server/candidates/privacy";
import { toErrorResponse } from "@/lib/errors";

// Spec 006, FR-305 — LGPD art. 18, II: o titular baixa os próprios dados.
export async function GET() {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const data = await exportMyData(user.id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cltech-meus-dados.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
