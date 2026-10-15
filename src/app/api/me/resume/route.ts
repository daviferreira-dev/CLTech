import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { uploadResume } from "@/server/candidates/resume";
import { toErrorResponse, Errors } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["CANDIDATE"]);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return toErrorResponse(Errors.validation("Envie o arquivo no campo 'file'."));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadResume(user.id, { name: file.name, type: file.type, buffer });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
