import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { openChallenge } from "@/server/code-test/session";
import { toErrorResponse } from "@/lib/errors";

// Spec 005 US2: abre (ou retoma) o desafio da etapa atual da candidatura do próprio candidato.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const { id } = await params;
    return NextResponse.json(await openChallenge(user.id, id));
  } catch (err) {
    return toErrorResponse(err);
  }
}
