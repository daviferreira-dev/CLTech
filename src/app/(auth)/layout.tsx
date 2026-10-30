import Link from "next/link";
import { cn } from "@/lib/cn";
import { Logo, focusRing } from "@/components/ui";

// Telas de autenticação: painel da marca (navy) à esquerda e formulário à direita.
// No celular o painel some e a marca fica acima do formulário (DESIGN.md, "Acesso").
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="flex min-h-dvh bg-page">
      <section
        aria-label="Sobre a CLTech"
        className="m-2 hidden flex-1 flex-col justify-between gap-10 rounded-card bg-inverse p-10 text-on-color lg:flex xl:p-14"
      >
        <Link href="/" className={cn("self-start rounded-field", focusRing)}>
          <Logo size={32} tone="light" />
        </Link>
        <div className="max-w-lg space-y-4">
          <p className="font-display text-[44px] font-semibold leading-[48px] tracking-tight">
            Contrate pelo código, não pelo currículo bonito.
          </p>
          <p className="text-[16px] leading-6 text-on-color-muted">
            Triagem automática do currículo, teste de código corrigido na hora e análise do GitHub. A decisão de quem avança
            continua com a equipe.
          </p>
        </div>
        <ul className="grid max-w-lg grid-cols-3 gap-3 text-label" aria-label="Como a seleção funciona">
          {[
            ["Currículo", "compatibilidade com a vaga"],
            ["Código", "corrigido na hora"],
            ["GitHub", "portfólio verificado"],
          ].map(([title, text]) => (
            <li key={title} className="rounded-field bg-inverse-raised p-3">
              <span className="block font-display text-h3 text-on-color">{title}</span>
              <span className="font-normal text-on-color-muted">{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <Link href="/" className={cn("mb-8 rounded-field lg:hidden", focusRing)}>
          <Logo size={36} />
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
