"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { NETWORK_ERROR_MESSAGE, apiFetch, jsonInit } from "@/lib/api-client";
import { Button, Field, Input, Notice, textLinkClasses } from "@/components/ui";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    setFieldError(parsed.success ? undefined : parsed.error.issues[0]?.message);
    if (!parsed.success) return input.current?.focus();

    setLoading(true);
    const res = await apiFetch("/api/auth/password/forgot", jsonInit("POST", { email }));
    setLoading(false);
    if (res.ok) return setSent(true);
    setError(res.networkError ? NETWORK_ERROR_MESSAGE : (res.error?.message ?? "Não foi possível enviar agora. Tente de novo."));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-display text-fg">Esqueci minha senha</h1>
        <p className="text-body text-fg-muted">Informe o e-mail da sua conta. Mandamos um link para você criar uma senha nova.</p>
      </div>

      {sent ? (
        // Mesmo texto exista a conta ou não: a tela não revela quem está cadastrado.
        <Notice tone="success" title="Confira seu e-mail">
          Se houver uma conta com <strong>{email}</strong>, o link chega em alguns minutos. Ele vale por 1 hora. Não chegou? Olhe
          o spam ou peça de novo.
        </Notice>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field id="email" label="E-mail" error={fieldError}>
            <Input ref={input} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && (
            <p role="alert" className="text-body text-danger">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="h-11 w-full">
            {loading ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      )}

      <p className="text-center text-body text-fg-muted">
        Lembrou?{" "}
        <Link href="/entrar" className={textLinkClasses}>
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
