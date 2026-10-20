import { z } from "zod";
import {
  CODE_LANGUAGES,
  MAX_CASE_TIME_LIMIT_SECONDS,
  MAX_TIME_LIMIT_MINUTES,
  MIN_TIME_LIMIT_MINUTES,
} from "@/lib/codeTest";

// Spec 005 US4: cadastro de desafio no catálogo.
export const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  hidden: z.boolean().default(false),
});

export const createChallengeSchema = z.object({
  title: z.string().trim().min(1, "Informe o título do desafio."),
  statement: z.string().trim().min(1, "Informe o enunciado."),
  languages: z.array(z.enum(CODE_LANGUAGES)).min(1, "Escolha ao menos uma linguagem."),
  difficulty: z.enum(["EASY", "MID", "HARD"]),
  timeLimitSeconds: z.coerce.number().int().min(1).max(MAX_CASE_TIME_LIMIT_SECONDS).default(MAX_CASE_TIME_LIMIT_SECONDS),
  testCases: z
    .array(testCaseSchema)
    .min(1, "Cadastre ao menos um caso de teste.")
    .refine((cases) => cases.some((c) => !c.hidden), "Deixe ao menos um caso visível para o candidato."),
});
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export const updateChallengeSchema = createChallengeSchema.partial();
export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>;

// Spec 005 US1: configuração da etapa CODE_TEST em ProcessStage.config. Tudo opcional
// enquanto rascunho; a publicação exige completo (isCodeTestConfigComplete).
export const codeTestConfigSchema = z
  .object({
    challengeId: z.string().uuid("Desafio inválido.").optional(),
    languages: z.array(z.enum(CODE_LANGUAGES)).optional(),
    timeLimitMinutes: z.coerce
      .number()
      .int()
      .min(MIN_TIME_LIMIT_MINUTES, `O tempo mínimo é ${MIN_TIME_LIMIT_MINUTES} minutos.`)
      .max(MAX_TIME_LIMIT_MINUTES, `O tempo máximo é ${MAX_TIME_LIMIT_MINUTES} minutos.`)
      .optional(),
  })
  .strip();

// Spec 005 US2: rascunho e execução do candidato.
export const saveDraftSchema = z.object({
  language: z.enum(CODE_LANGUAGES),
  sourceCode: z.string().max(100_000, "O código excede o tamanho máximo de 100 mil caracteres."),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
