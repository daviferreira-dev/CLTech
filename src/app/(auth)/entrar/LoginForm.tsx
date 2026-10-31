"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { safeInternalPath } from "@/lib/safe-path";
import { cn } from "@/lib/cn";
import { Button, Field, GitHubIcon, Input, LinkedInIcon, PasswordInput, focusRing, textLinkClasses } from "@/components/ui";

const oauthClasses = cn(
  "flex h-11 w-full items-center justify-center gap-2.5 rounded-full text-body font-semibold transition-colors",
  focusRing,
);

const OAUTH_ERROR: Record<string, string> = {
  AccountNotLinked: "Essa conta do GitHub/LinkedIn já está vinculada a outro usuário da CLTech.",
  OAuthAccountNotLinked: "Essa conta do GitHub/LinkedIn já está vinculada a outro usuário da CLTech.",
  AccessDenied: "O acesso à conta não foi autorizado.",
  OAuthCallbackError: "Não foi possível concluir o login com o provedor. Tente de novo.",
  Callback: "Não foi possível concluir o login com o provedor. Tente de novo.",
  OAuthSignin: "Não foi possível iniciar o login com o provedor. Tente de novo.",
  Configuration: "Este login está indisponível no momento. Entre com e-mail e senha.",
  EmailNotVerified: "Confirme seu e-mail no GitHub/LinkedIn (o principal da conta) e tente de novo.",
};

/** A2: o servidor manda `blocked_<minutos>` quando o limite de tentativas estoura. */
function blockedMessage(code: string | undefined): string | null {
  const minutes = Number(code?.match(/^blocked_(\d+)$/)?.[1]);
  return minutes ? `Muitas tentativas. Tente de novo em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.` : null;
}

export function LoginForm({ linkedInEnabled }: { linkedInEnabled: boolean }) {
  const searchParams = useSearchParams();
  // Só destino interno: callbackUrl vem da URL e não pode virar redirecionamento aberto.
  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl")) ?? undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Erros do OAuth chegam como ?error=<tipo> (Auth.js redireciona para pages.signIn).
  const [error, setError] = useState<string | null>(() => OAUTH_ERROR[searchParams.get("error") ?? ""] ?? null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    // Erro em linha, ligado ao campo (aria-invalid + aria-describedby), em vez do balão do navegador.
    const errors = {
      email: !email.trim() ? "Informe seu e-mail." : !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Confira o e-mail: falta o @ ou o domínio." : undefined,
      password: !password ? "Informe sua senha." : undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    }).catch(() => ({ error: "network" }));

    setLoading(false);

    if (result?.error) {
      // FR-004: mensagem genérica, sem revelar se o e-mail existe. O e-mail digitado fica.
      const code = "code" in result ? result.code : undefined;
      setError(
        result.error === "network"
          ? "Sem conexão com o servidor. Tente de novo."
          : (blockedMessage(code) ?? "E-mail ou senha incorretos."),
      );
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
        <h1 className="font-display text-display text-fg">Entrar</h1>
        <p className="text-body text-fg-muted">
          {callbackUrl ? "Entre para continuar de onde parou." : "Acesse sua conta para acompanhar seus processos."}
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => signIn("github", { callbackUrl: callbackUrl ?? "/api/auth/post-login" })}
          className={cn(oauthClasses, "bg-[#181717] ring-1 ring-on-color/15 text-on-color hover:bg-black")}
        >
          <GitHubIcon />
          Entrar com GitHub
        </button>
        {linkedInEnabled && (
          <button
            type="button"
            onClick={() => signIn("linkedin", { callbackUrl: callbackUrl ?? "/api/auth/post-login?via=linkedin" })}
            className={cn(oauthClasses, "border border-fg-subtle/50 bg-surface text-fg hover:bg-page")}
          >
            <LinkedInIcon className="text-[#0A66C2]" />
            Entrar com LinkedIn
          </button>
        )}
        <p className="pt-1 text-center text-label font-normal text-fg-muted">
          Entrando pelo GitHub, seu perfil público vira portfólio verificado para o recrutador. Dá para desconectar no seu perfil.
        </p>
      </div>

      <div className="flex items-center gap-3 text-label font-normal text-fg-muted">
        <span className="h-px flex-1 bg-line" />
        ou com e-mail
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleCredentialsSubmit} className="space-y-4" noValidate>
        <Field id="email" label="E-mail" error={fieldErrors.email}>
          <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field id="password" label="Senha" error={fieldErrors.password}>
          <PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        {error && (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="h-11 w-full">
          {loading ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="text-center text-body text-fg-muted">
        Ainda não tem conta?{" "}
        <Link href={registerHref} className={textLinkClasses}>
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
