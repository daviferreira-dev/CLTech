import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { createJob, listRecruiterJobs } from "@/server/jobs/builder";
import { createJobSchema } from "@/lib/validation/jobs";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["RECRUITER", "ADMIN"]);
    const body = await req.json();
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Dados inválidos."));
    }
    const job = await createJob(user.id, parsed.data);
    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function GET() {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const items = await listRecruiterJobs();
    return NextResponse.json({ items });
  } catch (err) {
    return toErrorResponse(err);
  }
}
