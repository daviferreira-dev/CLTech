import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { getDashboard } from "@/server/jobs/dashboard";
import { toErrorResponse } from "@/lib/errors";
import { parseDateParam } from "@/lib/dateParam";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const params = req.nextUrl.searchParams;
    const jobId = params.get("jobId") ?? undefined;
    // Mesmos `de`/`ate` da visão geral (spec 010 US1.5).
    const result = await getDashboard(jobId, { from: parseDateParam(params.get("de")), to: parseDateParam(params.get("ate")) });
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
