import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { getApplicationDetail } from "@/server/applications/detail";
import { toErrorResponse } from "@/lib/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    const detail = await getApplicationDetail(id);
    return NextResponse.json(detail);
  } catch (err) {
    return toErrorResponse(err);
  }
}
