import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { updateDraftJob, getRecruiterJobView } from "@/server/jobs/builder";
import { updateJobSchema } from "@/lib/validation/jobs";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    const job = await getRecruiterJobView(id);
    return NextResponse.json(job);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    const body = await req.json();
    const parsed = updateJobSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Dados inválidos."));
    }
    const job = await updateDraftJob(id, parsed.data);
    return NextResponse.json(job);
  } catch (err) {
    return toErrorResponse(err);
  }
}
