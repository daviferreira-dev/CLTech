"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { apiFetch, jsonInit, NETWORK_ERROR_MESSAGE } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button, Card, CardBody, CardHeader, Field, Input, Notice, buttonClasses, textLinkClasses } from "@/components/ui";

const CONFIRMATION = "EXCLUIR";

/** Direitos do titular (spec 006, US4 e US5): baixar os próprios dados e excluir a conta. */
export function PrivacyCard() {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (typed.trim() !== CONFIRMATION) {
      setError(`Digite ${CONFIRMATION} para confirmar.`);
      return;
    }
    setDeleting(true);
    setError(null);
    const result = await apiFetch<null>("/api/me/account", jsonInit("DELETE", { confirmation: CONFIRMATION }));
    if (result.ok) {
      await signOut({ callbackUrl: "/?conta=excluida" });
      return;
    }
    setDeleting(false);
    if (result.status === 401) return;
    setError(result.networkError ? NETWORK_ERROR_MESSAGE : (result.error?.message ?? "Não foi possível excluir a conta."));
  }

  function close() {
    setConfirming(false);
    setTyped("");
    setError(null);
  }

  return (
    <Card as="section" aria-labelledby="privacidade">
      <CardHeader
        titleId="privacidade"
        title="Privacidade e seus dados"
        description={
          <>
            Seus direitos pela LGPD. Veja o{" "}
            <Link href="/privacidade" className={textLinkClasses}>
              aviso de privacidade
            </Link>
            .
          </>
        }
      />
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a href="/api/me/data-export" download className={buttonClasses({ variant: "secondary" })}>
          Baixar meus dados
        </a>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Excluir minha conta
        </Button>
      </CardBody>

      <ConfirmDialog
        open={confirming}
        title="Excluir sua conta?"
        tone="danger"
        confirmLabel="Excluir definitivamente"
        loading={deleting}
        onCancel={close}
        onConfirm={handleDelete}
        description={
          <div className="space-y-3">
            <p>
              Seu perfil, currículos, candidaturas e desafios são apagados de forma definitiva — não há como desfazer.
              Se quiser uma cópia, baixe seus dados antes.
            </p>
            <Field id="confirmar-exclusao" label={`Digite ${CONFIRMATION} para confirmar`} error={error ?? undefined}>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" disabled={deleting} />
            </Field>
          </div>
        }
      />
      {error && !confirming && (
        <CardBody>
          <Notice tone="danger">{error}</Notice>
        </CardBody>
      )}
    </Card>
  );
}
