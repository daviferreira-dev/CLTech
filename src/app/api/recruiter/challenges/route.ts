import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { createChallenge, listChallenges } from "@/server/code-test/challenges";
import { createChallengeSchema } from "@/lib/validation/challenges";
import { toErrorResponse, Errors } from "@/lib/errors";

// Spec 005 US4 — catálogo. Leitura para recrutador (configurar CODE_TEST); cadastro só ADMIN.
// Casos ocultos nunca saem na resposta (FR-201), nem para quem cadastrou.
export async function GET() {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    return NextResponse.json({ items: await listChallenges() });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["ADMIN"]);
    const parsed = createChallengeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Dados inválidos."));
    }
    return NextResponse.json(await createChallenge(parsed.data), { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
