import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { getJobsOverview } from "@/server/jobs/overview";
import { toErrorResponse } from "@/lib/errors";
import { parseDateParam } from "@/lib/dateParam";

const STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;

export async function GET(req: NextRequest) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const params = req.nextUrl.searchParams;
    const statusParam = params.get("status");
    const status = STATUSES.find((s) => s === statusParam);

    const result = await getJobsOverview({
      status,
      recruiterId: params.get("recrutador") ?? undefined,
      search: params.get("busca") ?? undefined,
      from: parseDateParam(params.get("de")),
      to: parseDateParam(params.get("ate")),
    });
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
