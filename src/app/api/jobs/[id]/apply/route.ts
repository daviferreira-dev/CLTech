import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { applyToJob } from "@/server/applications/apply";
import { toErrorResponse } from "@/lib/errors";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const { id } = await params;
    const result = await applyToJob(user.id, id);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
