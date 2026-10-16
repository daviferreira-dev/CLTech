// Formato único de erro da API — ver specs/001-portal-candidatura/contracts/api.md
//
// { "error": { "code": "RESUME_REQUIRED", "message": "..." } }

import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: ApiError): NextResponse {
  return NextResponse.json(
    { error: { code: error.code, message: error.message, ...error.details } },
    { status: error.status },
  );
}

/** Converte qualquer erro lançado numa rota em uma resposta HTTP no formato padrão. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return errorResponse(err);
  }
  console.error(err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Erro inesperado. Tente novamente." } },
    { status: 500 },
  );
}

// Erros de domínio reutilizados pelas rotas (FR-004, FR-022, FR-024, etc.)
export const Errors = {
  unauthenticated: () => new ApiError(401, "UNAUTHENTICATED", "É necessário entrar para continuar."),
  forbidden: () => new ApiError(403, "FORBIDDEN", "Você não tem permissão para acessar este recurso."),
  notFound: (what = "Recurso") => new ApiError(404, "NOT_FOUND", `${what} não encontrado.`),
  validation: (message: string) => new ApiError(400, "VALIDATION_ERROR", message),
  conflict: (code: string, message: string) => new ApiError(409, code, message),
  businessRule: (code: string, message: string) => new ApiError(422, code, message),
  payloadTooLarge: (message: string) => new ApiError(413, "PAYLOAD_TOO_LARGE", message),
  unsupportedMediaType: (message: string) => new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", message),
};
