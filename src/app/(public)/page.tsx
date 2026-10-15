import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-bold">CLTech</h1>
      <p className="text-slate-600">
        Plataforma de Seleção Automatizada e Inteligente de Talentos da 3aq Tecnologia.
        Encontre vagas, candidate-se e acompanhe seu processo — tudo pelo navegador.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/vagas" className="rounded bg-slate-900 px-5 py-2 text-white">
          Ver vagas
        </Link>
        <Link href="/cadastro" className="rounded border border-slate-300 px-5 py-2">
          Criar conta
        </Link>
        <Link href="/entrar" className="rounded border border-slate-300 px-5 py-2">
          Entrar
        </Link>
      </div>
    </div>
  );
}
