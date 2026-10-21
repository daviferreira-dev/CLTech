import { z } from "zod";
import { EDUCATION_LEVELS, LANGUAGE_LEVELS, PROFILE_LIMITS as L } from "@/lib/profile-details";

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use mês/ano válidos.");

const tags = (what: string) =>
  z
    .array(z.string().trim().min(1).max(L.tagLength, `Cada item de ${what} tem no máximo ${L.tagLength} caracteres.`))
    .max(L.tagCount, `Informe no máximo ${L.tagCount} ${what}.`);

const list = <T extends z.ZodTypeAny>(item: T, what: string) =>
  z.array(item).max(L.listItems, `Informe no máximo ${L.listItems} ${what}.`);

const experienceSchema = z
  .object({
    company: z.string().trim().min(1, "Informe a empresa de cada experiência.").max(L.company),
    role: z.string().trim().min(1, "Informe o cargo de cada experiência.").max(L.role),
    startDate: month,
    endDate: month.nullable(),
    isCurrent: z.boolean(),
    description: z.string().trim().max(L.description).nullable(),
  })
  .refine((e) => !(e.isCurrent && e.endDate), { message: "Experiência atual não tem data de fim." })
  // `YYYY-MM` compara certo como string.
  .refine((e) => !e.endDate || e.endDate >= e.startDate, { message: "A data de fim de uma experiência vem antes do início." });

const educationSchema = z
  .object({
    institution: z.string().trim().min(1, "Informe a instituição de cada formação.").max(L.institution),
    course: z.string().trim().min(1, "Informe o curso de cada formação.").max(L.course),
    level: z.enum(EDUCATION_LEVELS, { message: "Escolha o nível de cada formação." }),
    startDate: month.nullable(),
    endDate: month.nullable(),
    inProgress: z.boolean(),
  })
  .refine((e) => !e.startDate || !e.endDate || e.endDate >= e.startDate, {
    message: "A conclusão de uma formação vem antes do início.",
  });

const languageSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome de cada idioma.").max(L.languageName),
  level: z.enum(LANGUAGE_LEVELS, { message: "Escolha o nível de cada idioma." }),
});

const linkSchema = z.object({
  label: z.string().trim().min(1, "Informe o nome de cada link.").max(L.linkLabel),
  url: z
    .string()
    .trim()
    .max(L.linkUrl)
    .url("Link inválido.")
    .refine((u) => u.startsWith("https://"), { message: "Os links precisam começar com https://." }),
});

// FR-009: edição de nome, telefone, cidade/estado. E-mail não é editável aqui
// (é a chave de identidade — RN007). Spec 007 (FR-704): blocos do perfil profissional;
// cada lista enviada substitui a lista inteira, bloco omitido não muda.
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(8).max(20).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().length(2).optional().or(z.literal("")),
  headline: z.string().trim().max(L.headline, `O título tem no máximo ${L.headline} caracteres.`).nullable().optional(),
  summary: z.string().trim().max(L.summary, `O resumo tem no máximo ${L.summary} caracteres.`).nullable().optional(),
  technologies: tags("tecnologias").optional(),
  softSkills: tags("habilidades").optional(),
  experiences: list(experienceSchema, "experiências").optional(),
  educations: list(educationSchema, "formações").optional(),
  languages: list(languageSchema, "idiomas").optional(),
  links: list(linkSchema, "links").optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// RF02 / FR-010
export const connectExternalAccountSchema = z.object({
  provider: z.enum(["GITHUB", "LINKEDIN", "LATTES"]),
  url: z.string().url().optional(), // usado pelo Lattes, que é link manual
});

export type ConnectExternalAccountInput = z.infer<typeof connectExternalAccountSchema>;

// FR-014: PDF ou DOCX até 5 MB — validado também no servidor com magic number
// (ver src/server/candidates/resume.ts).
export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RESUME_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
