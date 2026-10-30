// Dados de demonstração da Sprint 1 — ver data-model.md "Dados de seed".
// Vagas já nascem PUBLISHED porque o construtor de vagas (RF04) é da Sprint 2;
// sem isso não há como demonstrar as histórias P1 (busca e candidatura).

import { Prisma, PrismaClient, type ProcessStageType, type WorkMode, type Seniority } from "@prisma/client";
import * as argon2 from "argon2";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CHALLENGES } from "./challenges";
import { encrypt } from "../src/server/crypto";
import { isLocalStorage, localObjectPath } from "../src/server/storage";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Senha123!"; // só para ambiente de demonstração — nunca em produção

async function hashedPassword(): Promise<string> {
  return argon2.hash(DEMO_PASSWORD);
}

const STANDARD_PIPELINE: ProcessStageType[] = [
  "RESUME_ANALYSIS",
  "GITHUB_ANALYSIS",
  "CODE_TEST",
  "TECH_INTERVIEW",
  "FINAL_OFFER",
];

const SHORT_PIPELINE: ProcessStageType[] = [
  "RESUME_ANALYSIS",
  "HR_INTERVIEW",
  "TECH_INTERVIEW",
  "FINAL_OFFER",
];

interface JobSeed {
  title: string;
  description: string;
  location: string;
  workMode: WorkMode;
  seniority: Seniority;
  technologies: string[];
  pipeline: ProcessStageType[];
}

const JOBS: JobSeed[] = [
  {
    title: "Desenvolvedor(a) Backend Node.js Júnior",
    description: "Manutenção e evolução de APIs internas da 3aq.",
    location: "Fortaleza, CE",
    workMode: "REMOTE",
    seniority: "JUNIOR",
    technologies: ["Node.js", "TypeScript", "PostgreSQL"],
    pipeline: SHORT_PIPELINE,
  },
  {
    title: "Desenvolvedor(a) Frontend React Pleno",
    description: "Construção das telas do portal de recrutamento e produtos internos.",
    location: "Fortaleza, CE",
    workMode: "HYBRID",
    seniority: "MID",
    technologies: ["React", "TypeScript", "Tailwind"],
    pipeline: STANDARD_PIPELINE,
  },
  {
    title: "Engenheiro(a) de Software Sênior",
    description: "Arquitetura dos serviços de IA de triagem e avaliação técnica.",
    location: "Fortaleza, CE",
    workMode: "ONSITE",
    seniority: "SENIOR",
    technologies: ["Python", "FastAPI", "Docker"],
    pipeline: STANDARD_PIPELINE,
  },
  {
    title: "Estagiário(a) de Desenvolvimento",
    description: "Apoio ao time de desenvolvimento em tarefas de manutenção.",
    location: "Fortaleza, CE",
    workMode: "ONSITE",
    seniority: "INTERN",
    technologies: ["JavaScript", "Git"],
    pipeline: SHORT_PIPELINE,
  },
  {
    title: "Desenvolvedor(a) Full-Stack Pleno",
    description: "Features ponta a ponta no portal CLTech, do banco à interface.",
    location: "Remoto (Brasil)",
    workMode: "REMOTE",
    seniority: "MID",
    technologies: ["React", "Node.js", "PostgreSQL"],
    pipeline: STANDARD_PIPELINE,
  },
];

async function main() {
  const passwordHash = await hashedPassword();

  const recruiter = await prisma.user.upsert({
    where: { email: "recrutador@3aq.dev" },
    update: {},
    create: {
      name: "Recrutador 3aq",
      email: "recrutador@3aq.dev",
      passwordHash,
      role: "RECRUITER",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@3aq.dev" },
    update: {},
    create: {
      name: "Administrador 3aq",
      email: "admin@3aq.dev",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`Seed: recrutador (${recruiter.email}) e admin (${admin.email}) prontos.`);

  for (const jobSeed of JOBS) {
    const existing = await prisma.job.findFirst({ where: { title: jobSeed.title } });
    if (existing) continue;

    await prisma.job.create({
      data: {
        title: jobSeed.title,
        description: jobSeed.description,
        company: "3aq Tecnologia",
        location: jobSeed.location,
        workMode: jobSeed.workMode,
        seniority: jobSeed.seniority,
        technologies: jobSeed.technologies,
        minimumRequirements: `Conhecimento em ${jobSeed.technologies.join(", ")}.`,
        status: "PUBLISHED",
        publishedAt: new Date(),
        createdById: recruiter.id,
        stages: {
          create: jobSeed.pipeline.map((type, index) => ({
            type,
            order: index,
            config: {},
          })),
        },
      },
    });
  }

  console.log(`Seed: ${JOBS.length} vagas publicadas.`);

  const challengeIds: string[] = [];
  for (const challengeSeed of CHALLENGES) {
    const existing = await prisma.challenge.findFirst({ where: { title: challengeSeed.title } });
    const challenge =
      existing ??
      (await prisma.challenge.create({
        data: { ...challengeSeed, testCases: challengeSeed.testCases as unknown as Prisma.InputJsonValue },
      }));
    challengeIds.push(challenge.id);
  }
  console.log(`Seed: ${CHALLENGES.length} desafios no catálogo.`);

  // As vagas de demonstração já nascem publicadas com CODE_TEST no pipeline: sem desafio
  // configurado, o candidato que chega à etapa ficaria travado (spec 005).
  const firstChallenge = await prisma.challenge.findUniqueOrThrow({ where: { id: challengeIds[0] } });
  const unconfiguredStages = await prisma.processStage.findMany({
    where: { type: "CODE_TEST", job: { title: { in: JOBS.map((job) => job.title) } } },
  });
  for (const stage of unconfiguredStages) {
    if ((stage.config as { challengeId?: string } | null)?.challengeId) continue;
    await prisma.processStage.update({
      where: { id: stage.id },
      data: {
        config: { challengeId: firstChallenge.id, languages: firstChallenge.languages, timeLimitMinutes: 60, maxTestRuns: 20 },
      },
    });
  }

  // Vaga encerrada com candidatura pré-existente — edge case do spec.md
  // ("vaga despublicada com candidatos inscritos").
  let closedJob = await prisma.job.findFirst({ where: { title: "Vaga Encerrada — Suporte Técnico" } });
  if (!closedJob) {
    closedJob = await prisma.job.create({
      data: {
        title: "Vaga Encerrada — Suporte Técnico",
        description: "Vaga de demonstração já encerrada.",
        company: "3aq Tecnologia",
        location: "Fortaleza, CE",
        workMode: "ONSITE",
        seniority: "JUNIOR",
        technologies: ["Suporte"],
        minimumRequirements: "Experiência com suporte técnico N1.",
        status: "CLOSED",
        publishedAt: new Date(),
        createdById: recruiter.id,
        stages: {
          create: [{ type: "RESUME_ANALYSIS", order: 0, config: {} }],
        },
      },
      include: { stages: true },
    });
  }

  const demoCandidateUser = await prisma.user.upsert({
    where: { email: "candidato.demo@example.com" },
    update: {},
    create: {
      name: "Candidato Demo",
      email: "candidato.demo@example.com",
      passwordHash,
      role: "CANDIDATE",
    },
  });

  const demoCandidate = await prisma.candidate.upsert({
    where: { userId: demoCandidateUser.id },
    update: {},
    create: { userId: demoCandidateUser.id, city: "Fortaleza", state: "CE" },
  });

  const demoResume = await prisma.resume.findFirst({ where: { candidateId: demoCandidate.id } });
  const resume =
    demoResume ??
    (await prisma.resume.create({
      data: {
        candidateId: demoCandidate.id,
        storageKey: "resumes/demo/cv-seed.pdf",
        originalFilename: "cv-seed.pdf",
        mimeType: "application/pdf",
        sizeBytes: 102400,
        isCurrent: true,
      },
    }));

  // Grava o arquivo da linha Resume no storage local (cifrado como uploadResume grava), senão
  // o download do currículo do candidato demo não tem o que entregar. No bucket remoto, não.
  if (isLocalStorage()) {
    const file = localObjectPath(resume.storageKey);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, encrypt(demoPdf("Candidato Demo - Suporte Tecnico").toString("base64")), "utf8");
  }

  const closedJobStage = await prisma.processStage.findFirstOrThrow({
    where: { jobId: closedJob.id },
    orderBy: { order: "asc" },
  });

  await prisma.application.upsert({
    where: { candidateId_jobId: { candidateId: demoCandidate.id, jobId: closedJob.id } },
    update: {},
    create: {
      candidateId: demoCandidate.id,
      jobId: closedJob.id,
      resumeId: resume.id,
      currentStageId: closedJobStage.id,
      status: "IN_PROGRESS",
    },
  });

  console.log("Seed: vaga encerrada com candidatura pré-existente criada.");
  console.log(`Seed: senha de demonstração para todos os usuários acima: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/** PDF mínimo de uma página com uma linha de texto, com a tabela xref correta. */
function demoPdf(text: string): Buffer {
  const content = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
