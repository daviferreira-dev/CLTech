"use client";

// Senha nova digitada duas vezes: usada em /redefinir-senha (com o token do link) e em
// /perfil/senha (com a senha atual). As regras são os schemas Zod do servidor.
import { useEffect, useState } from "react";
import { changePasswordSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { NETWORK_ERROR_MESSAGE, apiFetch, jsonInit } from "@/lib/api-client";
import { Button, Field, PasswordInput } from "@/components/ui";

type FieldName = "currentPassword" | "password" | "confirm";

export function NewPasswordForm({ mode, success, invalidLink }: { mode: "reset" | "change"; success: React.ReactNode; invalidLink?: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [values, setValues] = useState({ currentPassword: "", password: "", confirm: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState<React.ReactNode>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // O token sai da barra de endereço assim que é lido: não fica no histórico nem em Referer.
  useEffect(() => {
    if (mode !== "reset") return;
    const url = new URL(window.location.href);
    setToken(url.searchParams.get("token") ?? "");
    url.searchParams.delete("token");
    window.history.replaceState(null, "", url);
  }, [mode]);

  function focusField(field: FieldName) {
    document.getElementById(field)?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const payload = mode === "reset" ? { token, password: values.password, confirm: values.confirm } : values;
    const parsed = (mode === "reset" ? resetPasswordSchema : changePasswordSchema).safeParse(payload);
    if (!parsed.success) {
      const errors: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) errors[issue.path[0] as FieldName] ??= issue.message;
      setFieldErrors(errors);
      const first = (["currentPassword", "password", "confirm"] as const).find((f) => errors[f]);
      if (first) focusField(first);
      else setError(invalidLink);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const res = await apiFetch(mode === "reset" ? "/api/auth/password/reset" : "/api/me/password", jsonInit("POST", payload));
    setLoading(false);
    if (res.ok) return setDone(true);

    if (res.networkError) return setError(NETWORK_ERROR_MESSAGE);
    if (res.error?.code === "RESET_TOKEN_INVALID") return setError(invalidLink);
    const message = res.error?.message ?? "Não foi possível trocar a senha. Tente de novo.";
    if (/senha atual/i.test(message)) {
      setFieldErrors({ currentPassword: message });
      return focusField("currentPassword");
    }
    setError(message);
  }

  if (done) return <>{success}</>;

  const set = (field: FieldName) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {mode === "change" && (
        <Field id="currentPassword" label="Senha atual" error={fieldErrors.currentPassword}>
          <PasswordInput required autoComplete="current-password" value={values.currentPassword} onChange={set("currentPassword")} />
        </Field>
      )}
      <Field id="password" label="Senha nova" hint="Mínimo de 8 caracteres." error={fieldErrors.password}>
        <PasswordInput required minLength={8} autoComplete="new-password" value={values.password} onChange={set("password")} />
      </Field>
      <Field id="confirm" label="Repita a senha nova" error={fieldErrors.confirm}>
        <PasswordInput required autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />
      </Field>

      {error && (
        <div role="alert" className="text-body text-danger">
          {error}
        </div>
      )}

      <Button type="submit" loading={loading} className="h-11 w-full sm:w-auto">
        {loading ? "Salvando…" : "Salvar senha nova"}
      </Button>
    </form>
  );
}
