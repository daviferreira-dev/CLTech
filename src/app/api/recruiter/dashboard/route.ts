import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { getDashboard } from "@/server/jobs/dashboard";
import { toErrorResponse } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const jobId = req.nextUrl.searchParams.get("jobId") ?? undefined;
    const result = await getDashboard(jobId);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
