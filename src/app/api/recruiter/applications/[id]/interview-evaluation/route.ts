import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { listInterviewEvaluations, upsertInterviewEvaluation } from "@/server/applications/interview-evaluation";
import { interviewEvaluationSchema } from "@/lib/validation/applications";
import { toErrorResponse, Errors } from "@/lib/errors";

// Spec 009 (FR-903): fichas de entrevista da candidatura. Só RECRUITER/ADMIN (Princípio I).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    return NextResponse.json({ stages: await listInterviewEvaluations(id, user.id) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// Cria ou atualiza a ficha do usuário logado na etapa atual. STAGE_CLOSED / NOT_INTERVIEW_STAGE: 409.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    const parsed = interviewEvaluationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Ficha inválida."));
    }
    await upsertInterviewEvaluation(id, user.id, parsed.data);
    return NextResponse.json({ stages: await listInterviewEvaluations(id, user.id) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
