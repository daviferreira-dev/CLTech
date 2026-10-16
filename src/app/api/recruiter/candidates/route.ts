import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { searchCandidates } from "@/server/candidates/search";
import { candidateSearchQuerySchema } from "@/lib/validation/candidates";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const parsed = candidateSearchQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Busca inválida."));
    }
    const items = await searchCandidates(parsed.data.q);
    return NextResponse.json({ items });
  } catch (err) {
    return toErrorResponse(err);
  }
}
