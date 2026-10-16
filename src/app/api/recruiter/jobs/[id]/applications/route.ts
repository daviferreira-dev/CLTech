import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { listApplicationsForJob } from "@/server/applications/list-for-job";
import { toErrorResponse } from "@/lib/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    const items = await listApplicationsForJob(id);
    return NextResponse.json({ items });
  } catch (err) {
    return toErrorResponse(err);
  }
}
