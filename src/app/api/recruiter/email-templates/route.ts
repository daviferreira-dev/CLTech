import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { createEmailTemplate, listEmailTemplates } from "@/server/email/library";
import { emailTemplateSchema } from "@/lib/validation/emailTemplates";
import { toErrorResponse, Errors } from "@/lib/errors";

// Spec 008 — biblioteca de modelos de e-mail. Qualquer recrutador lê e cria (é conteúdo do
// processo seletivo, não catálogo restrito como os desafios).
export async function GET() {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    return NextResponse.json({ items: await listEmailTemplates() });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const parsed = emailTemplateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Dados inválidos."));
    }
    return NextResponse.json(await createEmailTemplate(parsed.data), { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
