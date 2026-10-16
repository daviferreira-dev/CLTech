import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { setStages } from "@/server/jobs/builder";
import { setStagesSchema } from "@/lib/validation/jobs";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    const body = await req.json();
    const parsed = setStagesSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Dados inválidos."));
    }
    const job = await setStages(id, parsed.data);
    return NextResponse.json({ stages: job.stages });
  } catch (err) {
    return toErrorResponse(err);
  }
}
