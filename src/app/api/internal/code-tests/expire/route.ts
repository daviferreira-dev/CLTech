import { NextRequest, NextResponse } from "next/server";
import { expireOverdueDrafts } from "@/server/code-test/session";
import { toErrorResponse, Errors } from "@/lib/errors";

// RF05-A1: varredura periódica (cron) que submete rascunhos com prazo vencido de quem não
// voltou à tela. Protegida por CRON_SECRET; sem a variável, a rota fica desligada.
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw Errors.unauthenticated();
    return NextResponse.json({ expired: await expireOverdueDrafts() });
  } catch (err) {
    return toErrorResponse(err);
  }
}
