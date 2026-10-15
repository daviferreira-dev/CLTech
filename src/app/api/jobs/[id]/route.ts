import { NextResponse } from "next/server";
import { getJobDetail } from "@/server/jobs/detail";
import { auth } from "@/server/auth/config";
import { toErrorResponse } from "@/lib/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const job = await getJobDetail(id, session?.user?.id ?? null);
    return NextResponse.json(job);
  } catch (err) {
    return toErrorResponse(err);
  }
}
