import Link from "next/link";

export default function RecrutamentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="border-b border-slate-200 px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-slate-600">
          <Link href="/recrutamento" className="hover:text-slate-900">
            Painel
          </Link>
          <Link href="/recrutamento/vagas" className="hover:text-slate-900">
            Minhas Vagas
          </Link>
          <Link href="/recrutamento/candidatos" className="hover:text-slate-900">
            Candidatos
          </Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
