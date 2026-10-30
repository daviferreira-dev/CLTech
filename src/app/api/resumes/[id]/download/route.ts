import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { getResumeFile } from "@/server/candidates/resume-access";
import { toErrorResponse } from "@/lib/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession();
    const { id } = await params;
    const file = await getResumeFile({ id: user.id, role: user.role }, id);
    // filename* (RFC 5987) preserva acentos; filename ASCII é o fallback de navegadores antigos.
    const asciiName = file.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
