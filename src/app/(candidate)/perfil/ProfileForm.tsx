"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { PROVIDER_LABEL } from "@/lib/labels";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FileDropzone } from "@/components/ui/FileDropzone";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ChipList,
  ErrorState,
  Field,
  Input,
  Notice,
  Skeleton,
  buttonClasses,
} from "@/components/ui";

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
    languages?: unknown;
  } | null;
  resume: { id: string; originalFilename: string; sizeBytes: number; uploadedAt?: string } | null;
}

type Provider = ExternalAccountView["provider"];

const PROVIDERS: Provider[] = ["GITHUB", "LINKEDIN", "LATTES"];

const ACCOUNT_STATUS: Record<ExternalAccountView["status"], { label: string; variant: "success" | "warning" | "neutral" | "muted" }> = {
  CONNECTED: { label: "Conectado", variant: "success" },
  PENDING: { label: "Sincronizando", variant: "neutral" },
  UNAVAILABLE: { label: "Indisponível", variant: "warning" },
  DISCONNECTED: { label: "Não conectado", variant: "muted" },
};

const SAVED_MESSAGE_MS = 4000;

/** Linguagens do snapshot do GitHub, da maior participação para a menor. */
function topLanguages(languages: unknown, limit = 6): string[] {
  if (!Array.isArray(languages)) return [];
  return languages
    .filter((l): l is { name: string; share?: number; bytes?: number } => typeof l?.name === "string")
    .sort((a, b) => (b.share ?? b.bytes ?? 0) - (a.share ?? a.bytes ?? 0))
    .slice(0, limit)
    .map((l) => l.name);
}

export function ProfileForm({
  next,
  resumeParse,
}: {
  /** Destino de retorno (`/perfil?next=/vagas/[id]`, spec 004 US2.2). Já validado no servidor. */
  next: string | null;
  resumeParse: { resumeId: string; parseStatus: "NOT_PARSED" | "PENDING" | "PARSED" | "FAILED" } | null;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [uploading, setUploading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<File | null>(null);

  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] = useState<Provider | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    const result = await apiFetch<ProfileView>("/api/me/profile");
    if (result.ok) setProfile(result.data);
    else setLoadFailed(true);
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [load]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setSaveResult(null);

    const form = new FormData(e.currentTarget);
    const result = await apiFetch<ProfileView>(
      "/api/me/profile",
      jsonInit("PATCH", {
        name: form.get("name"),
        phone: form.get("phone"),
        city: form.get("city"),
        state: form.get("state"),
      }),
    );
    setSaving(false);

    if (result.ok) {
      setProfile(result.data);
      setSaveResult({ tone: "success", text: "Alterações salvas." });
      // US3.7: a confirmação some sozinha; o espaço é reservado, então nada se desloca.
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveResult(null), SAVED_MESSAGE_MS);
    } else if (result.networkError) {
      setSaveResult({ tone: "danger", text: NETWORK_ERROR_MESSAGE });
    } else if (result.status !== 401) {
      setSaveResult({ tone: "danger", text: result.error?.message ?? "Não foi possível salvar as alterações." });
    }
  }

  async function uploadResume(file: File) {
    setResumeError(null);
    setJustUploaded(false);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await apiFetch<unknown>("/api/me/resume", { method: "POST", body: formData });
    setUploading(false);

    if (!result.ok) {
      if (result.status === 401) return;
      setResumeError(
        result.networkError ? NETWORK_ERROR_MESSAGE : (result.error?.message ?? "Não foi possível enviar o currículo."),
      );
      return;
    }
    setJustUploaded(true);
    await load();
    router.refresh(); // atualiza o parseStatus vindo do servidor
  }

  // FR-105: substituir o currículo vigente exige confirmação; o primeiro envio, não.
  function handleResumeFile(file: File) {
    if (profile?.resume) setPendingReplace(file);
    else uploadResume(file);
  }

  async function accountAction(provider: Provider, request: () => Promise<{ ok: boolean; status: number; networkError?: boolean; error?: { message: string } | null }>) {
    setBusyProvider(provider);
    setAccountError(null);
    const result = await request();
    setBusyProvider(null);
    if (!result.ok && result.status !== 401) {
      setAccountError(
        result.networkError
          ? NETWORK_ERROR_MESSAGE
          : (result.error?.message ?? `Não foi possível atualizar a conta ${PROVIDER_LABEL[provider]}.`),
      );
    }
    await load();
  }

  const handleConnect = (provider: Provider) =>
    accountAction(provider, () => apiFetch("/api/me/external-accounts", jsonInit("POST", { provider })));
  const handleRetry = (provider: Provider) =>
    accountAction(provider, () => apiFetch(`/api/me/external-accounts/${provider}/sync`, { method: "POST" }));
  const handleDisconnect = (provider: Provider) =>
    accountAction(provider, () => apiFetch(`/api/me/external-accounts/${provider}`, { method: "DELETE" }));

  if (loadFailed) {
    return <ErrorState title="Não foi possível carregar seu perfil." onRetry={load} />;
  }

  if (!profile) {
    return (
      <div role="status" aria-live="polite" className="space-y-6">
        <span className="sr-only">Carregando perfil…</span>
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
        <Skeleton className="h-48 w-full rounded-card" />
      </div>
    );
  }

  const languages = topLanguages(profile.githubProfile?.languages);
  const parseStatus = resumeParse && profile.resume && resumeParse.resumeId === profile.resume.id ? resumeParse.parseStatus : null;
  const location = [profile.city, profile.state].filter(Boolean).join(" / ");

  return (
    <div className="space-y-6">
      {next && !justUploaded && (
        <Notice tone="info" title="Falta pouco para se candidatar">
          Envie seu currículo no cartão abaixo e depois volte à vaga para concluir a candidatura.
        </Notice>
      )}

      {/* Identidade */}
      <Card as="section" aria-label="Identidade">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={profile.name} size="lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="break-words text-h2 text-ink-900">{profile.name}</p>
              <p className="break-all text-body text-ink-600 sm:break-words">
                {profile.email}
                {location && ` · ${location}`}
              </p>
            </div>
            {languages.length > 0 && (
              <div className="space-y-1">
                <p className="text-label text-ink-600">Principais tecnologias (GitHub)</p>
                <ChipList items={languages} label="Principais tecnologias" />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Dados básicos */}
      <Card as="section" aria-labelledby="dados-basicos">
        <CardHeader titleId="dados-basicos" title="Dados Básicos" />
        <CardBody>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="name" label="Nome Completo" className="sm:col-span-2">
                <Input name="name" defaultValue={profile.name} autoComplete="name" />
              </Field>
              <Field id="email" label="E-mail" hint="O e-mail identifica sua conta e não pode ser alterado aqui.">
                <Input value={profile.email} readOnly disabled />
              </Field>
              <Field id="phone" label="Telefone">
                <Input name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" />
              </Field>
              <Field id="city" label="Cidade">
                <Input name="city" defaultValue={profile.city ?? ""} autoComplete="address-level2" />
              </Field>
              <Field id="state" label="Estado (UF)">
                <Input name="state" maxLength={2} defaultValue={profile.state ?? ""} className="uppercase" autoComplete="address-level1" />
              </Field>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Altura reservada: a mensagem entra e sai sem deslocar o layout (US3.7). */}
              <div className="min-h-5" aria-live="polite">
                {saveResult && (
                  <p role={saveResult.tone === "danger" ? "alert" : undefined} className={saveResult.tone === "danger" ? "text-body text-danger-600" : "text-body text-ink-900"}>
                    {saveResult.tone === "success" && <span aria-hidden="true" className="mr-1 text-accent-600">✓</span>}
                    {saveResult.text}
                  </p>
                )}
              </div>
              <Button type="submit" loading={saving}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Currículo */}
      <Card as="section" aria-labelledby="curriculo">
        <CardHeader
          titleId="curriculo"
          title="Currículo"
          description="É a partir dele que calculamos seu match com cada vaga."
        />
        <CardBody className="space-y-4">
          {justUploaded && (
            <Notice
              tone="success"
              title="Currículo salvo."
              action={
                next ? (
                  <ButtonLink href={next} size="sm">
                    Voltar à vaga
                  </ButtonLink>
                ) : undefined
              }
            >
              {next ? "Agora você já pode concluir sua candidatura." : "Seu match com as vagas será atualizado em instantes."}
            </Notice>
          )}

          {profile.resume ? (
            <div className="flex flex-col gap-3 rounded-card border border-brand-100 bg-canvas p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="break-all text-body font-medium text-ink-900">Arquivo atual: {profile.resume.originalFilename}</p>
                <p className="text-label font-normal text-ink-600">{(profile.resume.sizeBytes / 1024).toFixed(0)} KB</p>
                {parseStatus === "PARSED" && <Badge variant="success">Leitura Concluída</Badge>}
                {parseStatus === "FAILED" && (
                  <p className="text-body text-ink-900">
                    <Badge variant="warning" className="mr-2">
                      Texto não lido
                    </Badge>
                    Não conseguimos ler o texto deste arquivo (ex.: PDF escaneado). Isso reduz a precisão do seu match.
                  </p>
                )}
              </div>
              <a href={`/api/resumes/${profile.resume.id}/download`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Baixar
              </a>
            </div>
          ) : (
            <p className="text-body text-ink-600">Nenhum currículo enviado ainda.</p>
          )}

          <FileDropzone
            accept=".pdf,.docx"
            label={profile.resume ? "Enviar um novo arquivo: arraste ou clique para selecionar" : "Arraste seu currículo ou clique para selecionar"}
            hint="PDF ou DOCX, até 5 MB."
            busy={uploading}
            error={resumeError}
            onFile={handleResumeFile}
          />
        </CardBody>
      </Card>

      {/* Contas externas */}
      <Card as="section" aria-labelledby="contas">
        <CardHeader titleId="contas" title="Conecte suas contas" description="Portfólio público usado como sinal complementar ao currículo." />
        <CardBody className="space-y-3">
          {profile.githubProfile && (
            <p className="text-body text-ink-600">
              GitHub: {profile.githubProfile.publicRepoCount} repositórios públicos · {profile.githubProfile.activityLast90Days} eventos nos últimos 90 dias.
            </p>
          )}
          {accountError && <Notice tone="danger">{accountError}</Notice>}
          <ul className="space-y-3">
            {PROVIDERS.map((provider) => {
              const account = profile.externalAccounts.find((a) => a.provider === provider);
              const status = account?.status ?? "DISCONNECTED";
              const busy = busyProvider === provider;
              const info = ACCOUNT_STATUS[status];
              return (
                <li key={provider} className="flex flex-col gap-3 rounded-card border border-brand-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-canvas text-body font-bold text-ink-900">
                      {PROVIDER_LABEL[provider]?.[0]}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="text-body font-medium text-ink-900">
                        {PROVIDER_LABEL[provider]}
                        {account?.externalUsername && <span className="font-normal text-ink-600"> · {account.externalUsername}</span>}
                      </p>
                      <Badge variant={info.variant}>{info.label}</Badge>
                      {status === "UNAVAILABLE" && (
                        <p className="break-words text-body text-ink-600">{account?.unavailableReason ?? "Motivo desconhecido."}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {status === "CONNECTED" || status === "PENDING" ? (
                      <Button variant="secondary" size="sm" loading={busy} disabled={busyProvider !== null} onClick={() => setPendingDisconnect(provider)}>
                        Desconectar
                      </Button>
                    ) : status === "UNAVAILABLE" ? (
                      <Button variant="secondary" size="sm" loading={busy} disabled={busyProvider !== null} onClick={() => handleRetry(provider)}>
                        Tentar novamente
                      </Button>
                    ) : (
                      <Button size="sm" loading={busy} disabled={busyProvider !== null} onClick={() => handleConnect(provider)}>
                        Conectar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={pendingReplace !== null}
        title="Substituir currículo?"
        description={
          <>
            O arquivo <strong className="break-all">{pendingReplace?.name}</strong> passa a ser seu currículo vigente e o
            match com as vagas é recalculado. O anterior fica guardado no histórico.
          </>
        }
        confirmLabel="Substituir currículo"
        onCancel={() => setPendingReplace(null)}
        onConfirm={() => {
          const file = pendingReplace;
          setPendingReplace(null);
          if (file) uploadResume(file);
        }}
      />

      <ConfirmDialog
        open={pendingDisconnect !== null}
        title={`Desconectar ${pendingDisconnect ? PROVIDER_LABEL[pendingDisconnect] : ""}?`}
        description="Os dados coletados desta conta deixam de contar no seu perfil. Você pode conectá-la de novo depois."
        confirmLabel="Desconectar"
        tone="danger"
        onCancel={() => setPendingDisconnect(null)}
        onConfirm={() => {
          const provider = pendingDisconnect;
          setPendingDisconnect(null);
          if (provider) handleDisconnect(provider);
        }}
      />
    </div>
  );
}
