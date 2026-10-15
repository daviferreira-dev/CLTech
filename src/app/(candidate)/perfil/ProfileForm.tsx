"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ExternalAccountView {
  provider: "GITHUB" | "LINKEDIN" | "LATTES";
  status: "PENDING" | "CONNECTED" | "UNAVAILABLE" | "DISCONNECTED";
  externalUsername: string | null;
  unavailableReason: string | null;
}

interface ProfileView {
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  externalAccounts: ExternalAccountView[];
  githubProfile: {
    publicRepoCount: number;
    activityLast90Days: number;
  } | null;
  resume: { id: string; originalFilename: string; sizeBytes: number } | null;
}

const PROVIDERS: Array<ExternalAccountView["provider"]> = ["GITHUB", "LINKEDIN", "LATTES"];

export function ProfileForm() {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/me/profile");
    if (res.ok) setProfile(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone"),
        city: form.get("city"),
        state: form.get("state"),
      }),
    });

    setSaving(false);
    if (res.ok) {
      setProfile(await res.json());
      setMessage("Alterações salvas.");
    } else {
      setMessage("Não foi possível salvar as alterações.");
    }
  }

  async function handleResumeUpload(file: File) {
    setResumeError(null);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/me/resume", { method: "POST", body: formData });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setResumeError(body?.error?.message ?? "Não foi possível enviar o currículo.");
      return;
    }
    await load();
  }

  async function handleConnect(provider: ExternalAccountView["provider"]) {
    await fetch("/api/me/external-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    await load();
  }

  async function handleDisconnect(provider: ExternalAccountView["provider"]) {
    await fetch(`/api/me/external-accounts/${provider}`, { method: "DELETE" });
    await load();
  }

  async function handleRetry(provider: ExternalAccountView["provider"]) {
    await fetch(`/api/me/external-accounts/${provider}/sync`, { method: "POST" });
    await load();
  }

  if (!profile) return <p>Carregando…</p>;

  return (
    <div className="space-y-10">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Nome
          </label>
          <input
            id="name"
            name="name"
            defaultValue={profile.name}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">E-mail</label>
          <input disabled value={profile.email} className="mt-1 w-full rounded border border-slate-200 bg-slate-100 px-3 py-2" />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium">
            Telefone
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={profile.phone ?? ""}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="city" className="block text-sm font-medium">
              Cidade
            </label>
            <input
              id="city"
              name="city"
              defaultValue={profile.city ?? ""}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="w-24">
            <label htmlFor="state" className="block text-sm font-medium">
              UF
            </label>
            <input
              id="state"
              name="state"
              maxLength={2}
              defaultValue={profile.state ?? ""}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 uppercase"
            />
          </div>
        </div>

        {message && <p className="text-sm text-slate-600">{message}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Currículo</h2>
        {profile.resume ? (
          <p className="text-sm text-slate-600">
            Arquivo atual: {profile.resume.originalFilename} (
            {(profile.resume.sizeBytes / 1024).toFixed(0)} KB)
          </p>
        ) : (
          <p className="text-sm text-slate-500">Nenhum currículo enviado ainda.</p>
        )}

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleResumeUpload(file);
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-slate-300 p-8 text-center text-sm text-slate-500"
          onClick={() => fileInputRef.current?.click()}
        >
          Arraste um arquivo PDF ou DOCX (até 5 MB) ou clique para selecionar.
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleResumeUpload(file);
            }}
          />
        </div>
        {resumeError && <p className="text-sm text-red-600">{resumeError}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Contas externas</h2>
        {profile.githubProfile && (
          <p className="text-sm text-slate-600">
            GitHub: {profile.githubProfile.publicRepoCount} repositórios públicos ·{" "}
            {profile.githubProfile.activityLast90Days} eventos nos últimos 90 dias.
          </p>
        )}
        <ul className="space-y-2">
          {PROVIDERS.map((provider) => {
            const account = profile.externalAccounts.find((a) => a.provider === provider);
            const status = account?.status ?? "DISCONNECTED";
            return (
              <li key={provider} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                <div>
                  <span className="font-medium">{provider}</span>{" "}
                  <span className="text-sm text-slate-500">
                    {status === "UNAVAILABLE"
                      ? `Indisponível — ${account?.unavailableReason ?? "motivo desconhecido"}`
                      : status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {status === "CONNECTED" || status === "PENDING" ? (
                    <button onClick={() => handleDisconnect(provider)} className="text-sm underline">
                      Desconectar
                    </button>
                  ) : status === "UNAVAILABLE" ? (
                    <button onClick={() => handleRetry(provider)} className="text-sm underline">
                      Tentar novamente
                    </button>
                  ) : (
                    <button onClick={() => handleConnect(provider)} className="text-sm underline">
                      Conectar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
