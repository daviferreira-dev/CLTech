"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { safeInternalPath } from "@/lib/safe-path";
import { cn } from "@/lib/cn";
import { Button, Field, GitHubIcon, Input, LinkedInIcon, focusRing, textLinkClasses } from "@/components/ui";

const oauthClasses = cn(
  "flex h-11 w-full items-center justify-center gap-2.5 rounded-full text-body font-semibold transition-colors",
  focusRing,
);

const OAUTH_ERROR: Record<string, string> = {
  AccountNotLinked: "Essa conta do GitHub/LinkedIn já está vinculada a outro usuário da CLTech.",
  OAuthAccountNotLinked: "Essa conta do GitHub/LinkedIn já está vinculada a outro usuário da CLTech.",
  AccessDenied: "O acesso à conta não foi autorizado.",
  OAuthCallbackError: "Não foi possível concluir o login com o provedor. Tente de novo.",
};

export function LoginForm({ linkedInEnabled }: { linkedInEnabled: boolean }) {
  const searchParams = useSearchParams();
  // Só destino interno: callbackUrl vem da URL e não pode virar redirecionamento aberto.
  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl")) ?? undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Erros do OAuth chegam como ?error=<tipo> (Auth.js redireciona para pages.signIn).
  const [error, setError] = useState<string | null>(() => OAUTH_ERROR[searchParams.get("error") ?? ""] ?? null);
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
      <div className="space-y-1">
        <h1 className="font-display text-display text-ink-900">Entrar</h1>
        <p className="text-body text-ink-600">
          {callbackUrl ? "Entre para continuar de onde parou." : "Acesse sua conta para acompanhar seus processos."}
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => signIn("github", { callbackUrl: callbackUrl ?? "/api/auth/post-login" })}
          className={cn(oauthClasses, "bg-[#181717] text-surface hover:bg-black")}
        >
          <GitHubIcon />
          Entrar com GitHub
        </button>
        {linkedInEnabled && (
          <button
            type="button"
            onClick={() => signIn("linkedin", { callbackUrl: callbackUrl ?? "/api/auth/post-login" })}
            className={cn(oauthClasses, "border border-ink-400/50 bg-surface text-ink-900 hover:bg-canvas")}
          >
            <LinkedInIcon className="text-[#0A66C2]" />
            Entrar com LinkedIn
          </button>
        )}
        <p className="pt-1 text-center text-label font-normal text-ink-600">
          Entrando pelo GitHub, seu portfólio já chega verificado para o recrutador.
        </p>
      </div>

      <div className="flex items-center gap-3 text-label font-normal text-ink-600">
        <span className="h-px flex-1 bg-brand-100" />
        ou com e-mail
        <span className="h-px flex-1 bg-brand-100" />
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

        <Button type="submit" loading={loading} className="h-11 w-full">
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="text-center text-body text-ink-600">
        Ainda não tem conta?{" "}
        <Link href={registerHref} className={textLinkClasses}>
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
