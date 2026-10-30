import { NextRequest, NextResponse } from "next/server";
import { expireOverdueDrafts } from "@/server/code-test/session";
import { toErrorResponse, Errors } from "@/lib/errors";
import { authorizedCron } from "@/server/cron-auth";

// RF05-A1: varredura periódica (cron) que submete rascunhos com prazo vencido de quem não
// voltou à tela. Protegida por CRON_SECRET; sem a variável, a rota fica desligada.
// O cron da Vercel (vercel.json) chama com GET e manda `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    if (!authorizedCron(req.headers.get("authorization"))) throw Errors.unauthenticated();
    return NextResponse.json({ expired: await expireOverdueDrafts() });
  } catch (err) {
    return toErrorResponse(err);
  }
}
