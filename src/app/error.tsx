"use client";

import { ButtonLink, ErrorState } from "@/components/ui";

// Falha ao montar uma página no servidor ou no navegador. Sem este arquivo o Next mostra a tela
// padrão dele, em inglês e sem caminho de volta.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-10">
      <ErrorState
        className="w-full"
        title="Algo deu errado do nosso lado."
        description={
          <>
            Não foi culpa sua, e nada do que você digitou foi enviado. Tente de novo; se continuar, volte ao início e avise a
            equipe da 3aq.
            {error.digest && <span className="mt-2 block text-label">Código para a equipe: {error.digest}</span>}
          </>
        }
        onRetry={reset}
        action={<ButtonLink href="/">Voltar ao início</ButtonLink>}
      />
    </main>
  );
}
