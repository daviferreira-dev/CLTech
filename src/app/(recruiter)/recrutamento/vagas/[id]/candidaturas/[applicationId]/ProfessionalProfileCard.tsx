// Perfil profissional do candidato no relatório da candidatura (spec 007, US3).
// Seção vazia não aparece; perfil todo vazio mostra um aviso.

import {
  EDUCATION_LEVEL_LABEL,
  LANGUAGE_LEVEL_LABEL,
  formatPeriod,
  isProfileEmpty,
  type ProfileDetails,
} from "@/lib/profile-details";
import { Card, CardBody, CardHeader, ChipList, textLinkClasses } from "@/components/ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-label text-fg-muted">{title}</h3>
      {children}
    </div>
  );
}

/** Mais recente primeiro: atual antes, depois pelo início, decrescente. */
function byRecency<T extends { startDate: string | null }>(items: T[], ongoing: (item: T) => boolean): T[] {
  return [...items].sort((a, b) => {
    if (ongoing(a) !== ongoing(b)) return ongoing(a) ? -1 : 1;
    return (b.startDate ?? "").localeCompare(a.startDate ?? "");
  });
}

export function ProfessionalProfileCard({ profile }: { profile: ProfileDetails }) {
  return (
    <Card as="section" aria-labelledby="perfil-profissional">
      <CardHeader titleId="perfil-profissional" title="Perfil profissional" description={profile.headline ?? undefined} />
      <CardBody className="space-y-6">
        {isProfileEmpty(profile) ? (
          <p className="text-body text-fg-muted">O candidato ainda não preencheu o perfil profissional.</p>
        ) : (
          <>
            {profile.summary && (
              <Section title="Resumo">
                <p className="whitespace-pre-line break-words text-body text-fg">{profile.summary}</p>
              </Section>
            )}

            {profile.experiences.length > 0 && (
              <Section title="Experiências">
                <ol className="space-y-4">
                  {byRecency(profile.experiences, (e) => e.isCurrent).map((e, i) => (
                    <li key={i} className="border-l-2 border-line pl-3">
                      <p className="break-words text-body font-medium text-fg">
                        {e.role} · {e.company}
                      </p>
                      <p className="text-label font-normal text-fg-muted">{formatPeriod(e.startDate, e.endDate, e.isCurrent)}</p>
                      {e.description && <p className="mt-1 whitespace-pre-line break-words text-body text-fg">{e.description}</p>}
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {profile.educations.length > 0 && (
              <Section title="Formação">
                <ul className="space-y-3">
                  {byRecency(profile.educations, (e) => e.inProgress).map((e, i) => (
                    <li key={i}>
                      <p className="break-words text-body font-medium text-fg">{e.course}</p>
                      <p className="break-words text-body text-fg-muted">
                        {e.institution} · {EDUCATION_LEVEL_LABEL[e.level]}
                        {(e.startDate || e.endDate || e.inProgress) && ` · ${formatPeriod(e.startDate, e.endDate, e.inProgress) || "em andamento"}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {profile.technologies.length > 0 && (
              <Section title="Tecnologias">
                <ChipList items={profile.technologies} label="Tecnologias" />
              </Section>
            )}

            {profile.softSkills.length > 0 && (
              <Section title="Habilidades">
                <ChipList items={profile.softSkills} label="Habilidades" />
              </Section>
            )}

            {profile.languages.length > 0 && (
              <Section title="Idiomas">
                <ul className="flex flex-wrap gap-x-6 gap-y-1 text-body text-fg">
                  {profile.languages.map((l) => (
                    <li key={l.name}>
                      {l.name} <span className="text-fg-muted">· {LANGUAGE_LEVEL_LABEL[l.level]}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {profile.links.length > 0 && (
              <Section title="Links">
                <ul className="space-y-1">
                  {profile.links.map((l) => (
                    <li key={l.url} className="break-all text-body">
                      <span className="text-fg-muted">{l.label}: </span>
                      <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className={textLinkClasses}>
                        {l.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
