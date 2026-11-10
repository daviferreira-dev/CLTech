"use client";

// Último recurso: falha no layout raiz, onde nem o tema nem os componentes existem. Por isso
// carrega o próprio html e usa estilo direto, sem classes do projeto.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b1320", color: "#e8edf6" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "20vh 20px 40px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Algo deu errado do nosso lado.</h1>
          <p style={{ color: "#9aa9c0", lineHeight: 1.5, margin: "0 0 24px" }}>
            Não foi culpa sua, e nada do que você digitou foi enviado. Tente de novo; se continuar, avise a equipe da 3aq.
            {error.digest ? ` Código para a equipe: ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ padding: "10px 20px", borderRadius: 999, border: 0, background: "#2fd3a0", color: "#052a1f", fontWeight: 600, cursor: "pointer" }}
          >
            Tentar de novo
          </button>{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- sem layout raiz o roteador do Next pode não estar de pé */}
          <a href="/" style={{ color: "#e8edf6", marginLeft: 12 }}>Voltar ao início</a>
        </main>
      </body>
    </html>
  );
}
