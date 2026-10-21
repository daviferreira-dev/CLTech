import { describe, expect, it } from "vitest";
import { parseResume } from "@/server/candidates/resume-parse";

const CURRICULO = `Maria Souza
Desenvolvedora Full Stack Pleno
São Paulo - SP | (11) 98765-4321 | maria@exemplo.com
github.com/mariasouza | https://www.linkedin.com/in/mariasouza | https://mariasouza.dev

RESUMO
Desenvolvedora com 5 anos de experiência em aplicações web.
Foco em qualidade e entrega contínua.

EXPERIÊNCIA PROFISSIONAL
Desenvolvedora Full Stack | Acme Tecnologia
03/2021 - atual
- Construção de APIs em Node.js e TypeScript
- Front-end em React

Beta Sistemas — Desenvolvedora Júnior
jan 2019 – fev 2021
Manutenção de sistemas em Java e PostgreSQL.

FORMAÇÃO ACADÊMICA
Bacharelado em Ciência da Computação - Universidade de São Paulo
2015 - 2018

IDIOMAS
Inglês - Avançado
Espanhol: básico

HABILIDADES
Comunicação, Trabalho em equipe, Docker, Liderança
`;

describe("parseResume", () => {
  const draft = parseResume(CURRICULO);

  it("acha telefone, cidade e UF", () => {
    expect(draft.phone).toBe("(11) 98765-4321");
    expect(draft.city).toBe("São Paulo");
    expect(draft.state).toBe("SP");
  });

  it("acha o título pelo cargo nas primeiras linhas", () => {
    expect(draft.headline).toBe("Desenvolvedora Full Stack Pleno");
  });

  it("lê o resumo pela seção", () => {
    expect(draft.summary).toBe(
      "Desenvolvedora com 5 anos de experiência em aplicações web. Foco em qualidade e entrega contínua.",
    );
  });

  it("classifica os links e força https", () => {
    expect(draft.links).toEqual([
      { label: "GitHub", url: "https://github.com/mariasouza" },
      { label: "LinkedIn", url: "https://www.linkedin.com/in/mariasouza" },
      { label: "Portfólio", url: "https://mariasouza.dev" },
    ]);
  });

  it("acha tecnologias por palavra inteira", () => {
    expect(draft.technologies).toEqual(
      expect.arrayContaining(["Node.js", "TypeScript", "React", "Java", "PostgreSQL", "Docker"]),
    );
    expect(draft.technologies).not.toContain("JavaScript");
  });

  it("separa experiências com cargo, empresa e período", () => {
    expect(draft.experiences).toEqual([
      {
        company: "Acme Tecnologia",
        role: "Desenvolvedora Full Stack",
        startDate: "2021-03",
        endDate: "",
        isCurrent: true,
        description: "- Construção de APIs em Node.js e TypeScript\n- Front-end em React",
      },
      {
        company: "Beta Sistemas",
        role: "Desenvolvedora Júnior",
        startDate: "2019-01",
        endDate: "2021-02",
        isCurrent: false,
        description: "Manutenção de sistemas em Java e PostgreSQL.",
      },
    ]);
  });

  it("lê a formação com nível deduzido", () => {
    expect(draft.educations).toEqual([
      {
        institution: "Universidade de São Paulo",
        course: "Bacharelado em Ciência da Computação",
        level: "GRADUACAO",
        startDate: "2015-01",
        endDate: "2018-01",
        inProgress: false,
      },
    ]);
  });

  it("lê idiomas com nível", () => {
    expect(draft.languages).toEqual([
      { name: "Inglês", level: "AVANCADO" },
      { name: "Espanhol", level: "BASICO" },
    ]);
  });

  it("habilidades comportamentais deixam tecnologias de fora", () => {
    expect(draft.softSkills).toEqual(["Comunicação", "Trabalho em equipe", "Liderança"]);
  });

  it("usa as tecnologias extras (das vagas) além do catálogo", () => {
    expect(parseResume("Experiência com Quarkus e Kotlin", ["Quarkus"]).technologies).toEqual(["Kotlin", "Quarkus"]);
  });

  it("texto vazio ou sem nada reconhecível volta rascunho vazio", () => {
    const empty = parseResume("");
    expect(empty.experiences).toEqual([]);
    expect(empty.technologies).toEqual([]);
    expect(empty.phone).toBeUndefined();
  });

  it("formato com cargo e empresa em linhas separadas e mês por extenso", () => {
    const d = parseResume(`EXPERIÊNCIA
Gama S.A.
Analista de Sistemas
Março de 2017 até Dezembro de 2018
Suporte a sistemas legados.`);
    expect(d.experiences).toEqual([
      {
        company: "Gama S.A.",
        role: "Analista de Sistemas",
        startDate: "2017-03",
        endDate: "2018-12",
        isCurrent: false,
        description: "Suporte a sistemas legados.",
      },
    ]);
  });
});
