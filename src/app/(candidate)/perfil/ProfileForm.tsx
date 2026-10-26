"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { PROVIDER_LABEL } from "@/lib/labels";
import { parseLattesProfile, parseLinkedinProfile } from "@/lib/external-profiles";
import { signIn } from "next-auth/react";
import type { ProfileDetails } from "@/lib/profile-details";
import type { ProfileDraft } from "@/lib/profile-form";
import { ProfileDetailsForm } from "./ProfileDetailsForm";
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
  textLinkClasses,
} from "@/components/ui";

interface ExternalAccountView {
  provider: "GITHUB" | "LINKEDIN" | "LATTES";
  status: "PENDING" | "CONNECTED" | "UNAVAILABLE" | "DISCONNECTED";
  externalUsername: string | null;
  url: string | null;
  verifiedAt: string | null;
  verifiedName: string | null;
  unavailableReason: string | null;
}

interface ProfileView {
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  details: ProfileDetails;
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

// Conectar GitHub/LinkedIn passa pelo OAuth do provedor (prova de posse da conta): o
// Auth.js vincula o provedor ao usuário logado e volta para /perfil?conectar=<PROVEDOR>.
const OAUTH_ID: Partial<Record<Provider, string>> = { GITHUB: "github", LINKEDIN: "linkedin" };

// Link pedido depois do OAuth (LinkedIn, que não devolve o link público) ou direto (Lattes).
// Validado aqui para dar retorno imediato e de novo no servidor (lib/external-profiles.ts).
type LinkProvider = "LINKEDIN" | "LATTES";
const CONNECT_INPUT: Record<LinkProvider, { label: string; placeholder: string; error: string; parse: (v: string) => unknown }> = {
  LINKEDIN: {
    label: "Link do perfil do LinkedIn",
    placeholder: "https://www.linkedin.com/in/seu-perfil",
    error: "Informe o link do seu perfil (linkedin.com/in/…).",
    parse: parseLinkedinProfile,
  },
  LATTES: {
    label: "Link do currículo Lattes",
    placeholder: "http://lattes.cnpq.br/0000000000000000",
    error: "Informe o link do seu currículo Lattes (lattes.cnpq.br/…).",
    parse: parseLattesProfile,
  },
};

// A coleta do GitHub roda em segundo plano (R6): enquanto há conta "Sincronizando", a tela
// recarrega o perfil a cada POLL_MS, até POLL_MAX vezes.
const POLL_MS = 3000;
const POLL_MAX = 20;

const ACCOUNT_STATUS: Record<ExternalAccountView["status"], { label: string; variant: "success" | "warning" | "neutral" | "muted" }> = {
  CONNECTED: { label: "Conectado", variant: "success" },
  PENDING: { label: "Sincronizando", variant: "neutral" },
  UNAVAILABLE: { label: "Indisponível", variant: "warning" },
  DISCONNECTED: { label: "Não conectado", variant: "muted" },
};

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
  returningFrom,
  linkedInEnabled,
}: {
  /** Destino de retorno (`/perfil?next=/vagas/[id]`, spec 004 US2.2). Já validado no servidor. */
  next: string | null;
  resumeParse: { resumeId: string; parseStatus: "NOT_PARSED" | "PENDING" | "PARSED" | "FAILED" } | null;
  /** Provedor cujo OAuth acabou de concluir (`/perfil?conectar=GITHUB`). */
  returningFrom: "GITHUB" | "LINKEDIN" | null;
  /** Sem LINKEDIN_ID o provedor não existe no Auth.js — o botão some. */
  linkedInEnabled: boolean;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<File | null>(null);
  // Spec 007: rascunho lido do último currículo enviado; o formulário mescla nos campos vazios.
  const [draft, setDraft] = useState<{ nonce: number; value: ProfileDraft } | null>(null);

  const [busyProvider, setBusyProvider] = useState<Provider | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] = useState<Provider | null>(null);
  const [connecting, setConnecting] = useState<LinkProvider | null>(null);
  const [connectValue, setConnectValue] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const load = useCallback(async () => {
    setLoadFailed(false);
    const result = await apiFetch<ProfileView>("/api/me/profile");
    if (result.ok) setProfile(result.data);
    else setLoadFailed(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasPending = profile?.externalAccounts.some((a) => a.status === "PENDING") ?? false;
  useEffect(() => {
    if (!hasPending || pollCount >= POLL_MAX) return;
    const timer = setTimeout(() => {
      setPollCount((n) => n + 1);
      load();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [hasPending, pollCount, load]);

  async function uploadResume(file: File) {
    setResumeError(null);
    setJustUploaded(false);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await apiFetch<{ draft: ProfileDraft | null }>("/api/me/resume", { method: "POST", body: formData });
    setUploading(false);

    if (!result.ok) {
      if (result.status === 401) return;
      setResumeError(
        result.networkError ? NETWORK_ERROR_MESSAGE : (result.error?.message ?? "Não foi possível enviar o currículo."),
      );
      return;
    }
    setJustUploaded(true);
    if (result.data.draft) setDraft({ nonce: Date.now(), value: result.data.draft });
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
    setPollCount(0);
    await load();
    return result.ok;
  }

  function openLinkForm(provider: LinkProvider) {
    setConnecting(provider);
    setConnectValue("");
    setConnectError(null);
    setAccountError(null);
  }

  function startConnect(provider: Provider) {
    const oauthId = OAUTH_ID[provider];
    if (!oauthId) {
      openLinkForm(provider as LinkProvider);
      return;
    }
    setBusyProvider(provider);
    const back = new URLSearchParams({ conectar: provider });
    if (next) back.set("next", next);
    void signIn(oauthId, { callbackUrl: `/perfil?${back}` });
  }

  // Volta do OAuth: GitHub conecta direto (o usuário sai da conta autorizada); LinkedIn
  // abre o campo do link. O parâmetro sai da URL para um F5 não repetir a ação.
  const handledReturn = useRef(false);
  useEffect(() => {
    if (!returningFrom || handledReturn.current) return;
    handledReturn.current = true;
    router.replace(next ? `/perfil?next=${encodeURIComponent(next)}` : "/perfil", { scroll: false });
    if (returningFrom === "GITHUB") {
      void accountAction("GITHUB", () => apiFetch("/api/me/external-accounts", jsonInit("POST", { provider: "GITHUB" })));
    } else {
      openLinkForm("LINKEDIN");
    }
    // accountAction/openLinkForm são recriadas a cada render; o ref garante uma execução só.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returningFrom]);

  async function submitConnect(event: React.FormEvent, provider: LinkProvider) {
    event.preventDefault();
    const value = connectValue.trim();
    if (!CONNECT_INPUT[provider].parse(value)) {
      setConnectError(CONNECT_INPUT[provider].error);
      return;
    }
    setConnectError(null);
    const ok = await accountAction(provider, () => apiFetch("/api/me/external-accounts", jsonInit("POST", { provider, url: value })));
    if (ok) setConnecting(null);
  }
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
              {profile.details.headline && <p className="break-words text-body font-medium text-ink-900">{profile.details.headline}</p>}
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

      {/* Currículo */}
      <Card as="section" aria-labelledby="curriculo">
        <CardHeader
          titleId="curriculo"
          title="Currículo"
          description="É a partir dele que calculamos seu match com cada vaga. Ao enviar, preenchemos os campos vazios do perfil abaixo com o que conseguirmos ler — você revisa e salva."
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

      {/* Dados básicos + perfil profissional (spec 007) */}
      <ProfileDetailsForm profile={profile} draft={draft} onSaved={setProfile} />

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
                <li key={provider} className="flex flex-col gap-3 rounded-card border border-brand-100 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-canvas text-body font-bold text-ink-900">
                      {PROVIDER_LABEL[provider]?.[0]}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="text-body font-medium text-ink-900">
                        {PROVIDER_LABEL[provider]}
                        {status !== "DISCONNECTED" && account?.externalUsername && (
                          <span className="font-normal text-ink-600">
                            {" · "}
                            {account.url ? (
                              <a href={account.url} target="_blank" rel="noopener noreferrer" className={textLinkClasses}>
                                {account.externalUsername}
                              </a>
                            ) : (
                              account.externalUsername
                            )}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={info.variant}>{info.label}</Badge>
                        {status !== "DISCONNECTED" && account?.verifiedAt && <Badge variant="success">Verificado</Badge>}
                      </div>
                      {status !== "DISCONNECTED" && account?.verifiedAt && account.verifiedName && (
                        <p className="break-words text-label text-ink-600">
                          Conta de {account.verifiedName}, confirmada pelo {PROVIDER_LABEL[provider]}.
                        </p>
                      )}
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
                      <>
                        <Button variant="secondary" size="sm" loading={busy} disabled={busyProvider !== null} onClick={() => handleRetry(provider)}>
                          Tentar novamente
                        </Button>
                        <Button variant="secondary" size="sm" disabled={busyProvider !== null} onClick={() => setPendingDisconnect(provider)}>
                          Desconectar
                        </Button>
                      </>
                    ) : connecting === provider ? null : provider === "LINKEDIN" && !linkedInEnabled ? (
                      <span className="text-label text-ink-600">Indisponível no momento</span>
                    ) : (
                      <Button size="sm" loading={busy} disabled={busyProvider !== null} onClick={() => startConnect(provider)}>
                        {OAUTH_ID[provider] ? `Conectar com ${PROVIDER_LABEL[provider]}` : "Conectar"}
                      </Button>
                    )}
                  </div>
                  {connecting === provider && status === "DISCONNECTED" && (
                    <form className="flex w-full flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => submitConnect(e, connecting)} noValidate>
                      <Field
                        id={`conectar-${provider}`}
                        label={CONNECT_INPUT[connecting].label}
                        hint={
                          provider === "LINKEDIN" ? (
                            <>
                              Conta {account?.verifiedName ? `de ${account.verifiedName} ` : ""}confirmada. O LinkedIn não informa o link
                              público no login:{" "}
                              {/* /in/me redireciona para o perfil de quem está logado no LinkedIn. */}
                              <a href="https://www.linkedin.com/in/me/" target="_blank" rel="noopener noreferrer" className={textLinkClasses}>
                                abra seu perfil
                              </a>{" "}
                              e copie o endereço da página aqui.
                            </>
                          ) : undefined
                        }
                        error={connectError}
                        className="min-w-0 flex-1"
                      >
                        <Input
                          value={connectValue}
                          onChange={(e) => setConnectValue(e.target.value)}
                          placeholder={CONNECT_INPUT[connecting].placeholder}
                          autoComplete="url"
                          autoFocus
                        />
                      </Field>
                      <div className="flex shrink-0 gap-2">
                        <Button type="submit" size="sm" loading={busy} disabled={busyProvider !== null}>
                          Salvar
                        </Button>
                        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setConnecting(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}
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
