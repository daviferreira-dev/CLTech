import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { connectExternalAccount } from "@/server/candidates/external-accounts";
import { connectExternalAccountSchema } from "@/lib/validation/profile";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const body = await req.json();
    const parsed = connectExternalAccountSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Dados inválidos."));
    }
    const result = await connectExternalAccount(user.id, parsed.data);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
