import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { getResumeDownloadUrl } from "@/server/candidates/resume-access";
import { toErrorResponse } from "@/lib/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession();
    const { id } = await params;
    const url = await getResumeDownloadUrl({ id: user.id, role: user.role }, id);
    return NextResponse.redirect(url);
  } catch (err) {
    return toErrorResponse(err);
  }
}
