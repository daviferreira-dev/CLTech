import { PageContainer } from "@/components/layout/AppShell";
import { ButtonLink } from "@/components/ui";

const STEPS = [
  { title: "Encontre a vaga", text: "Filtre por modalidade, senioridade e tecnologia e veja seu match com cada vaga." },
  { title: "Candidate-se", text: "Envie seu currículo uma vez e candidate-se em um clique." },
  { title: "Acompanhe", text: "Veja em que etapa está cada processo, incluindo o desafio técnico." },
];

export default function HomePage() {
  return (
    <PageContainer className="flex min-h-[70dvh] flex-col items-center justify-center gap-10 text-center">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-[28px] font-bold leading-9 text-ink-900 sm:text-display">CLTech</h1>
        <p className="text-body text-ink-600 sm:text-[16px] sm:leading-6">
          Plataforma de Seleção Automatizada e Inteligente de Talentos da 3aq Tecnologia. Encontre vagas, candidate-se e
          acompanhe seu processo — tudo pelo navegador.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <ButtonLink href="/vagas">Ver vagas</ButtonLink>
          <ButtonLink href="/cadastro" variant="secondary">
            Criar conta
          </ButtonLink>
          <ButtonLink href="/entrar" variant="ghost">
            Entrar
          </ButtonLink>
        </div>
      </div>
      <ol className="grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-card border border-brand-100 bg-surface p-4 sm:p-6">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100 text-label text-ink-900">
              {index + 1}
            </span>
            <h2 className="mt-3 text-h3 text-ink-900">{step.title}</h2>
            <p className="mt-1 text-body text-ink-600">{step.text}</p>
          </li>
        ))}
      </ol>
    </PageContainer>
  );
}
