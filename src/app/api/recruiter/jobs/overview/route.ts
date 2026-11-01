import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { getJobsOverview } from "@/server/jobs/overview";
import { toErrorResponse } from "@/lib/errors";

const STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

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
      from: parseDate(params.get("de")),
      to: parseDate(params.get("ate")),
    });
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
