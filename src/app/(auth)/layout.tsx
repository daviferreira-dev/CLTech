import Link from "next/link";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui";

// Telas de autenticação: painel centralizado com a marca no topo (spec 003 US6).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className={cn("mb-6 flex items-center gap-2 rounded-field", focusRing)}>
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-field bg-brand-900 text-body font-bold text-surface"
        >
          CL
        </span>
        <span className="text-h2 font-bold text-brand-900">CLTech</span>
      </Link>
      <div className="w-full max-w-sm rounded-card border border-brand-100 bg-surface p-6 sm:p-8">{children}</div>
    </main>
  );
}
