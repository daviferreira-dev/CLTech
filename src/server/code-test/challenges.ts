// Spec 005 US4 — catálogo de desafios. FR-201: casos com `hidden: true` nunca saem daqui,
// nem para o recrutador; só a contagem deles.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import type { CreateChallengeInput, UpdateChallengeInput } from "@/lib/validation/challenges";

export interface StoredTestCase {
  input: string;
  expectedOutput: string;
  hidden: boolean;
}

export interface VisibleTestCase {
  index: number;
  input: string;
  expectedOutput: string;
}

export interface ChallengePublicView {
  id: string;
  title: string;
  statement: string;
  languages: string[];
  difficulty: "EASY" | "MID" | "HARD";
  timeLimitSeconds: number;
  visibleCases: VisibleTestCase[];
  hiddenCaseCount: number;
}

export function parseTestCases(value: unknown): StoredTestCase[] {
  if (!Array.isArray(value)) return [];
  return value.map((c) => ({
    input: String((c as StoredTestCase)?.input ?? ""),
    expectedOutput: String((c as StoredTestCase)?.expectedOutput ?? ""),
    hidden: Boolean((c as StoredTestCase)?.hidden),
  }));
}

/** Única função que transforma um Challenge em resposta de API: corta os casos ocultos. */
export function toPublicView(challenge: {
  id: string;
  title: string;
  statement: string;
  languages: string[];
  difficulty: "EASY" | "MID" | "HARD";
  timeLimitSeconds: number;
  testCases: unknown;
}): ChallengePublicView {
  const cases = parseTestCases(challenge.testCases);
  return {
    id: challenge.id,
    title: challenge.title,
    statement: challenge.statement,
    languages: challenge.languages,
    difficulty: challenge.difficulty,
    timeLimitSeconds: challenge.timeLimitSeconds,
    // O índice é o do conjunto completo: é por ele que a justificativa identifica cada caso.
    visibleCases: cases
      .map((c, index) => ({ c, index }))
      .filter(({ c }) => !c.hidden)
      .map(({ c, index }) => ({ index, input: c.input, expectedOutput: c.expectedOutput })),
    hiddenCaseCount: cases.filter((c) => c.hidden).length,
  };
}

export async function listChallenges(): Promise<ChallengePublicView[]> {
  const challenges = await prisma.challenge.findMany({ orderBy: { createdAt: "desc" } });
  return challenges.map(toPublicView);
}

export async function getChallenge(id: string): Promise<ChallengePublicView> {
  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge) throw Errors.notFound("Desafio");
  return toPublicView(challenge);
}

export async function createChallenge(input: CreateChallengeInput): Promise<ChallengePublicView> {
  const challenge = await prisma.challenge.create({
    data: { ...input, testCases: input.testCases as unknown as Prisma.InputJsonValue },
  });
  return toPublicView(challenge);
}

/** Desafio já usado por alguma etapa de pipeline. */
export async function isChallengeInUse(challengeId: string): Promise<boolean> {
  const stage = await prisma.processStage.findFirst({
    where: { type: "CODE_TEST", config: { path: ["challengeId"], equals: challengeId } },
    select: { id: true },
  });
  return stage !== null;
}

/**
 * US4.2: com o desafio em uso, casos de teste, linguagens e limite de tempo não mudam —
 * mudariam a nota de submissões passadas. Cria-se um desafio novo. Título e enunciado
 * podem ser corrigidos.
 */
export async function updateChallenge(id: string, input: UpdateChallengeInput): Promise<ChallengePublicView> {
  const existing = await prisma.challenge.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw Errors.notFound("Desafio");

  const touchesGrading = input.testCases !== undefined || input.languages !== undefined || input.timeLimitSeconds !== undefined;
  if (touchesGrading && (await isChallengeInUse(id))) {
    throw Errors.conflict(
      "CHALLENGE_IN_USE",
      "Este desafio já é usado por alguma vaga: casos de teste, linguagens e tempo não podem mudar. Cadastre um desafio novo.",
    );
  }

  const challenge = await prisma.challenge.update({
    where: { id },
    data: {
      ...input,
      ...(input.testCases ? { testCases: input.testCases as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  return toPublicView(challenge);
}
