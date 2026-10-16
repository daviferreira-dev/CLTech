import { NextRequest, NextResponse } from "next/server";
import { listPublishedJobs } from "@/server/jobs/list";
import { jobListQuerySchema } from "@/lib/validation/jobs";
import { toErrorResponse, Errors } from "@/lib/errors";
import { getOptionalSession } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  try {
    const parsed = jobListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Filtro inválido."));
    }
    const session = await getOptionalSession();
    const result = await listPublishedJobs(parsed.data, session?.id ?? null);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
