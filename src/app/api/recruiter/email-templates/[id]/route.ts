import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { deleteEmailTemplate, updateEmailTemplate } from "@/server/email/library";
import { updateEmailTemplateSchema } from "@/lib/validation/emailTemplates";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    const parsed = updateEmailTemplateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Dados inválidos."));
    }
    return NextResponse.json(await updateEmailTemplate(id, parsed.data));
  } catch (err) {
    return toErrorResponse(err);
  }
}

// TEMPLATE_IS_DEFAULT: modelo padrão não pode ser excluído. Vagas que usavam o modelo voltam ao padrão.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["RECRUITER", "ADMIN"]);
    const { id } = await params;
    await deleteEmailTemplate(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
