import { NextRequest, NextResponse } from "next/server";
import { isLocalStorage, readLocalObject, verifyLocalSignature } from "@/server/storage";
import { toErrorResponse, Errors } from "@/lib/errors";

// Equivalente local da URL assinada do bucket (STORAGE_ENDPOINT="local", só desenvolvimento).
// A autorização já aconteceu em quem gerou a URL; aqui só vale a assinatura e o prazo.
export async function GET(req: NextRequest) {
  try {
    if (!isLocalStorage()) throw Errors.notFound("Arquivo");
    const params = req.nextUrl.searchParams;
    const key = params.get("key") ?? "";
    const expires = Number(params.get("expires"));
    if (!verifyLocalSignature(key, expires, params.get("signature") ?? "")) throw Errors.forbidden();

    let body: Buffer;
    try {
      body = await readLocalObject(key);
    } catch {
      throw Errors.notFound("Arquivo");
    }
    return new NextResponse(new Uint8Array(body), {
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
