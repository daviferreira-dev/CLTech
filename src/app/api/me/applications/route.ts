import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { listMyApplications } from "@/server/applications/list";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const applications = await listMyApplications(user.id);
    return NextResponse.json(applications);
  } catch (err) {
    return toErrorResponse(err);
  }
}
