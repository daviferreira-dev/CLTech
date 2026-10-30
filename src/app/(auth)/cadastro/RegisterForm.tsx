"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { registerSchema } from "@/lib/validation/auth";
import { safeInternalPath } from "@/lib/safe-path";
import { NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/cn";
import { Button, Field, GitHubIcon, Input, PasswordInput, focusRing, textLinkClasses } from "@/components/ui";

type FieldName = "name" | "email" | "password";

// O servidor devolve só a mensagem do primeiro erro do mesmo schema; o texto identifica o campo.
const SERVER_MESSAGE_FIELD: Array<[RegExp, FieldName]> = [
  [/nome/i, "name"],
  [/e-mail/i, "email"],
  [/senha/i, "password"],
];

export function RegisterForm() {
  const searchParams = useSearchParams();
  // Spec 004 US2.1: quem veio de uma vaga volta a ela depois do cadastro.
  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl"));

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    // Mesmo schema Zod do servidor: as regras não mudam, só passam a aparecer sob o campo.
    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const errors: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName;
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    let res: Response;
    try {
      res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
    } catch {
      setLoading(false);
      setError(NETWORK_ERROR_MESSAGE);
      return;
    }

    if (!res.ok) {
      setLoading(false);
      const body = await res.json().catch(() => null);
      const message: string = body?.error?.message ?? "Não foi possível criar a conta.";
      const field = SERVER_MESSAGE_FIELD.find(([pattern]) => pattern.test(message))?.[1];
      if (field) setFieldErrors({ [field]: message });
      else setError(message);
      return;
    }

    // FR-001/FR-006: conta criada e já autenticada — volta à origem ou cai em /vagas.
    window.location.href = callbackUrl ?? "/api/auth/post-login";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-display text-fg">Criar conta</h1>
        <p className="text-body text-fg-muted">Candidate-se a vagas e acompanhe cada etapa do processo.</p>
      </div>

      <button
        type="button"
        onClick={() => signIn("github", { callbackUrl: callbackUrl ?? "/api/auth/post-login" })}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-[#181717] ring-1 ring-on-color/15 text-body font-semibold text-on-color transition-colors hover:bg-black",
          focusRing,
        )}
      >
        <GitHubIcon />
        Criar conta com GitHub
      </button>

      <div className="flex items-center gap-3 text-label font-normal text-fg-muted">
        <span className="h-px flex-1 bg-line" />
        ou com e-mail
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="name" label="Nome" error={fieldErrors.name}>
          <Input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="email" label="E-mail" error={fieldErrors.email}>
          <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field id="password" label="Senha" hint="Mínimo de 8 caracteres." error={fieldErrors.password}>
          <PasswordInput required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        {error && (
          <p role="alert" className="text-body text-danger">
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Criando conta…" : "Criar conta"}
        </Button>
        <p className="text-center text-label text-fg-muted">
          Ao criar a conta você declara ter lido o{" "}
          <Link href="/privacidade" className={textLinkClasses}>
            aviso de privacidade
          </Link>
          .
        </p>
      </form>

      <p className="text-center text-body text-fg-muted">
        Já tem conta?{" "}
        <Link href={callbackUrl ? `/entrar?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/entrar"} className={textLinkClasses}>
          Entrar
        </Link>
      </p>
    </div>
  );
}
