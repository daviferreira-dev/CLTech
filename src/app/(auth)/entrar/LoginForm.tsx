"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { safeInternalPath } from "@/lib/safe-path";
import { Button, Field, Input, textLinkClasses } from "@/components/ui";

export function LoginForm({ linkedInEnabled }: { linkedInEnabled: boolean }) {
  const searchParams = useSearchParams();
  // Só destino interno: callbackUrl vem da URL e não pode virar redirecionamento aberto.
  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl")) ?? undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    }).catch(() => ({ error: "network" }));

    setLoading(false);

    if (result?.error) {
      // FR-004: mensagem genérica, sem revelar se o e-mail existe. O e-mail digitado fica.
      setError(result.error === "network" ? "Sem conexão com o servidor. Tente de novo." : "E-mail ou senha incorretos.");
      setPassword("");
      return;
    }

    // Navegação completa (não router.push): o destino é decidido pelo servidor
    // a partir do papel da sessão (FR-006), uma rota de API, não uma página RSC.
    window.location.href = callbackUrl ?? "/api/auth/post-login";
  }

  const registerHref = callbackUrl ? `/cadastro?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/cadastro";

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-h2 text-ink-900">Entrar</h1>
        <p className="text-body text-ink-600">
          {callbackUrl ? "Entre para continuar de onde parou." : "Acesse sua conta para acompanhar seus processos."}
        </p>
      </div>

      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <Field id="email" label="E-mail">
          <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field id="password" label="Senha">
          <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        {error && (
          <p role="alert" className="text-body text-danger-600">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-label font-normal text-ink-600">
        <span className="h-px flex-1 bg-brand-100" />
        ou
        <span className="h-px flex-1 bg-brand-100" />
      </div>

      <div className="space-y-2">
        <Button variant="secondary" className="w-full" onClick={() => signIn("github", { callbackUrl: callbackUrl ?? "/api/auth/post-login" })}>
          Entrar com GitHub
        </Button>
        {linkedInEnabled && (
          <Button variant="secondary" className="w-full" onClick={() => signIn("linkedin", { callbackUrl: callbackUrl ?? "/api/auth/post-login" })}>
            Entrar com LinkedIn
          </Button>
        )}
      </div>

      <p className="text-center text-body text-ink-600">
        Ainda não tem conta?{" "}
        <Link href={registerHref} className={textLinkClasses}>
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
