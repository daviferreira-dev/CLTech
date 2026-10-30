import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SENIORITY_LABEL, jobPlace } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { ButtonLink, GitHubIcon, Icon, Notice, focusRing } from "@/components/ui";
import { HomeHero } from "@/components/home/HomeHero";
import { FunnelLine } from "@/components/home/FunnelLine";
import { Reveal } from "@/components/motion/Reveal";

// As vagas mudam a todo momento: a página inicial não é gerada no build.
export const dynamic = "force-dynamic";

interface HomeJob {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: string;
  seniority: string;
  technologies: string[];
}

async function latestJobs(): Promise<{ jobs: HomeJob[]; total: number }> {
  try {
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 3,
        select: { id: true, title: true, company: true, location: true, workMode: true, seniority: true, technologies: true },
      }),
      prisma.job.count({ where: { status: "PUBLISHED" } }),
    ]);
    return { jobs, total };
  } catch {
    // Banco fora do ar não derruba a página inicial: a seção de vagas só some.
    return { jobs: [], total: 0 };
  }
}

const FOR_CANDIDATES = [
  "Envie o currículo uma vez e candidate-se a qualquer vaga em um clique.",
  "Veja sua compatibilidade com cada vaga antes de se inscrever.",
  "Faça o teste de código no navegador, com salvamento automático.",
  "Acompanhe em que etapa está cada processo e receba o resultado por e-mail.",
];
const FOR_TEAM = [
  "Candidatos ordenados por nota, com o motivo de cada número.",
  "Correção automática dos testes: a equipe sênior volta para o produto.",
  "Todos avaliados pelos mesmos critérios, com histórico num lugar só.",
  "Dados pessoais criptografados e exportáveis, conforme a LGPD.",
];

function CheckList({ items, tone }: { items: string[]; tone: "accent" | "primary" }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} data-reveal className="flex gap-3 text-[15px] leading-6 text-fg">
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
              tone === "accent" ? "bg-success-soft text-success-strong" : "bg-action-soft text-link",
            )}
          >
            <Icon name="check" className="h-3.5 w-3.5" />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ conta?: string }> }) {
  const { conta } = await searchParams;
  const { jobs, total } = await latestJobs();

  return (
    <div className="bg-page">
      {conta === "excluida" && (
        <div className="mx-auto max-w-content px-4 pt-6 sm:px-6">
          <Notice tone="success">Sua conta e todos os seus dados foram excluídos.</Notice>
        </div>
      )}

      <HomeHero />
      <FunnelLine />

      <section aria-labelledby="publicos-titulo" className="mx-auto max-w-content px-4 py-20 sm:px-6 lg:py-28">
        <h2 id="publicos-titulo" className="sr-only">
          Para quem é a CLTech
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal className="space-y-6 rounded-card bg-surface p-8 sm:p-10">
            <div data-reveal className="space-y-2">
              <h3 className="font-display text-[28px] font-semibold leading-9 tracking-tight text-fg">Para quem procura vaga</h3>
              <p className="text-[16px] leading-7 text-fg-muted">Seu código fala por você, mesmo que o currículo não seja perfeito.</p>
            </div>
            <CheckList items={FOR_CANDIDATES} tone="accent" />
            <div data-reveal>
              <ButtonLink href="/cadastro" variant="secondary" className="h-11 px-5">
                Criar conta de candidato
              </ButtonLink>
            </div>
          </Reveal>
          <Reveal className="space-y-6 rounded-card bg-inverse p-8 text-on-color sm:p-10">
            <div data-reveal className="space-y-2">
              <h3 className="font-display text-[28px] font-semibold leading-9 tracking-tight">Para a equipe da 3aq</h3>
              <p className="text-[16px] leading-7 text-on-color-muted">Menos tempo lendo PDF, mais tempo conversando com quem já provou que sabe.</p>
            </div>
            <ul className="space-y-3">
              {FOR_TEAM.map((item) => (
                <li key={item} data-reveal className="flex gap-3 text-[15px] leading-6">
                  <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success text-inverse">
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div data-reveal>
              <Link
                href="/entrar"
                className={cn(
                  "inline-flex h-11 items-center rounded-full bg-surface px-5 text-body font-semibold text-fg transition-colors hover:bg-action-soft",
                  focusRing,
                )}
              >
                Entrar como recrutador
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {jobs.length > 0 && (
        <section aria-labelledby="vagas-titulo" className="bg-surface">
          <div className="mx-auto max-w-content space-y-10 px-4 py-20 sm:px-6 lg:py-24">
            <Reveal className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="vagas-titulo" data-reveal className="font-display text-[34px] font-semibold leading-[40px] tracking-tight text-fg sm:text-[40px] sm:leading-[44px]">
                {total === 1 ? "1 vaga aberta agora" : `${total} vagas abertas agora`}
              </h2>
              <div data-reveal>
                <ButtonLink href="/vagas" variant="secondary" className="h-11 px-5">
                  Ver todas as vagas
                </ButtonLink>
              </div>
            </Reveal>
            <Reveal as="ul" className="grid gap-4 md:grid-cols-3">
              {jobs.map((job) => (
                <li key={job.id} data-reveal>
                  <Link
                    href={`/vagas/${job.id}`}
                    className={cn(
                      "group flex h-full flex-col gap-4 rounded-card border border-line bg-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:border-action/40 hover:shadow-popover",
                      focusRing,
                    )}
                  >
                    <div className="space-y-1">
                      <p className="text-label font-semibold text-fg-muted">{job.company}</p>
                      <h3 className="font-display text-[20px] font-semibold leading-7 text-fg group-hover:text-link">{job.title}</h3>
                      <p className="text-body text-fg-muted">
                        {[SENIORITY_LABEL[job.seniority], jobPlace(job.location, job.workMode)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <ul className="mt-auto flex flex-wrap gap-1.5" aria-label="Tecnologias">
                      {job.technologies.slice(0, 4).map((tech) => (
                        <li key={tech} className="rounded-full bg-page px-2.5 py-1 text-label text-fg">
                          {tech}
                        </li>
                      ))}
                    </ul>
                  </Link>
                </li>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      <section aria-labelledby="cta-titulo" className="px-2 py-2">
        <Reveal className="mx-auto flex max-w-content flex-col items-start gap-8 overflow-hidden rounded-card bg-inverse px-6 py-14 text-on-color sm:px-12 lg:flex-row lg:items-center lg:justify-between lg:py-16">
          <div data-reveal className="max-w-2xl space-y-3">
            <h2 id="cta-titulo" className="font-display text-[34px] font-semibold leading-[40px] tracking-tight sm:text-[44px] sm:leading-[48px]">
              Seu GitHub vale mais que um PDF.
            </h2>
            <p className="text-[16px] leading-7 text-on-color-muted">Conecte a conta e seu portfólio chega verificado ao recrutador.</p>
          </div>
          <div data-reveal className="flex flex-wrap gap-3">
            <a
              href="/entrar"
              className={cn(
                "inline-flex h-12 items-center gap-2.5 rounded-full bg-surface px-6 text-[15px] font-semibold text-fg transition-colors hover:bg-action-soft",
                focusRing,
              )}
            >
              <GitHubIcon />
              Entrar com GitHub
            </a>
            <Link
              href="/vagas"
              className={cn(
                "inline-flex h-12 items-center rounded-full border border-on-color/40 px-6 text-[15px] font-semibold text-on-color transition-colors hover:bg-on-color/10",
                focusRing,
              )}
            >
              Ver vagas
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
