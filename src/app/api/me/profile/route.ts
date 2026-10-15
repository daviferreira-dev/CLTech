import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { getProfile, updateProfile } from "@/server/candidates/profile";
import { updateProfileSchema } from "@/lib/validation/profile";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const profile = await getProfile(user.id);
    return NextResponse.json(profile);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(Errors.validation(parsed.error.issues[0]?.message ?? "Dados inválidos."));
    }
    const profile = await updateProfile(user.id, parsed.data);
    return NextResponse.json(profile);
  } catch (err) {
    return toErrorResponse(err);
  }
}
