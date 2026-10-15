import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/session";
import { disconnectExternalAccount } from "@/server/candidates/external-accounts";
import { toErrorResponse, Errors } from "@/lib/errors";

const VALID_PROVIDERS = ["GITHUB", "LINKEDIN", "LATTES"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

function parseProvider(value: string): Provider {
  const upper = value.toUpperCase();
  if (!VALID_PROVIDERS.includes(upper as Provider)) {
    throw Errors.validation("Provedor inválido.");
  }
  return upper as Provider;
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const user = await requireRole(["CANDIDATE"]);
    const { provider } = await params;
    await disconnectExternalAccount(user.id, parseProvider(provider));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
