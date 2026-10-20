// Chamadas de API feitas pelos containers de tela (lado do cliente).
//
// Spec 004 US7: um 401 em qualquer ação autenticada leva a /entrar?callbackUrl=<rota atual>
// e o usuário volta ao ponto onde estava — aproveitando o 401 limpo de sessão órfã (d4ceaa2).
// Falha de rede não vira exceção solta: volta como `networkError` para a tela preservar o que
// o usuário digitou e oferecer tentar de novo.

export interface ApiErrorBody {
  code: string;
  message: string;
  [key: string]: unknown;
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiErrorBody | null; networkError: boolean };

function redirectToLogin() {
  const here = `${window.location.pathname}${window.location.search}`;
  window.location.href = `/entrar?callbackUrl=${encodeURIComponent(here)}`;
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    return { ok: false, status: 0, error: null, networkError: true };
  }

  if (res.status === 401) {
    redirectToLogin();
    // A navegação já começou; a tela não deve reagir a este resultado.
    return { ok: false, status: 401, error: { code: "UNAUTHENTICATED", message: "Sessão expirada." }, networkError: false };
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = body && typeof body === "object" && "error" in body ? (body.error as ApiErrorBody) : null;
    return { ok: false, status: res.status, error, networkError: false };
  }
  return { ok: true, status: res.status, data: body as T };
}

export function jsonInit(method: string, payload?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  };
}

export const NETWORK_ERROR_MESSAGE = "Sem conexão com o servidor. Verifique sua internet e tente de novo — nada do que você digitou foi perdido.";
