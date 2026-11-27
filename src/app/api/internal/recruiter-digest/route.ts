import { NextRequest, NextResponse } from "next/server";
import { sendRecruiterDigests } from "@/server/jobs/digest";
import { toErrorResponse, Errors } from "@/lib/errors";
import { authorizedCron } from "@/server/cron-auth";

// Spec 010 FR-1005: resumo diário dos candidatos parados, um e-mail por recrutador.
// Protegida por CRON_SECRET, como a varredura de prazos; sem a variável, a rota fica desligada.
// O cron da Vercel (vercel.json) chama com GET e manda `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    if (!authorizedCron(req.headers.get("authorization"))) throw Errors.unauthenticated();
    return NextResponse.json(await sendRecruiterDigests());
  } catch (err) {
    return toErrorResponse(err);
  }
}
