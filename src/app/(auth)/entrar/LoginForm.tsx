"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginForm({ linkedInEnabled }: { linkedInEnabled: boolean }) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      // FR-004: mensagem genérica, sem revelar se o e-mail existe.
      setError("E-mail ou senha incorretos.");
      return;
    }

    // Navegação completa (não router.push): o destino é decidido pelo servidor
    // a partir do papel da sessão (FR-006), uma rota de API, não uma página RSC.
    window.location.href = callbackUrl ?? "/api/auth/post-login";
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 py-16">
      <h1 className="text-2xl font-semibold">Entrar</h1>

      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className="space-y-2">
        <button
          onClick={() => signIn("github", { callbackUrl: callbackUrl ?? "/api/auth/post-login" })}
          className="w-full rounded border border-slate-300 px-4 py-2"
        >
          Entrar com GitHub
        </button>
        {linkedInEnabled && (
          <button
            onClick={() => signIn("linkedin", { callbackUrl: callbackUrl ?? "/api/auth/post-login" })}
            className="w-full rounded border border-slate-300 px-4 py-2"
          >
            Entrar com LinkedIn
          </button>
        )}
      </div>

      <p className="text-sm text-slate-600">
        Ainda não tem conta?{" "}
        <a href="/cadastro" className="underline">
          Cadastre-se
        </a>
      </p>
    </div>
  );
}
