import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { closeJob } from "@/server/jobs/builder";
import { toErrorResponse } from "@/lib/errors";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    const job = await closeJob(id);
    return NextResponse.json({ id: job.id, status: job.status });
  } catch (err) {
    return toErrorResponse(err);
  }
}
