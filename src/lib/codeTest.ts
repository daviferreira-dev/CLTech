// Contrato compartilhado do teste técnico (spec 005, RF05/RF06) — usado pelo servidor e
// pelas telas. Nada aqui depende de Prisma.

/**
 * D5 (decidido em 20/10/2026): teto de execuções de teste antes da submissão final e
 * execuções simultâneas por candidato. Valores únicos aqui para facilitar o ajuste.
 */
export const MAX_TEST_RUNS = 20;
export const MAX_CONCURRENT_RUNS_PER_CANDIDATE = 1;

/** Limites do tempo de prova configurável pelo recrutador, em minutos. */
export const MIN_TIME_LIMIT_MINUTES = 5;
export const MAX_TIME_LIMIT_MINUTES = 240;
export const DEFAULT_TIME_LIMIT_MINUTES = 60;

/** Teto por caso de teste (RNF06). */
export const MAX_CASE_TIME_LIMIT_SECONDS = 10;

/** Linguagens que o sandbox sabe executar. `Challenge.languages` usa estas chaves. */
export const CODE_LANGUAGES = ["python", "javascript", "typescript", "java", "cpp", "go"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const LANGUAGE_LABEL: Record<string, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  go: "Go",
};

export const DIFFICULTY_LABEL: Record<string, string> = { EASY: "Fácil", MID: "Médio", HARD: "Difícil" };

/** Configuração de uma etapa CODE_TEST, gravada em `ProcessStage.config`. */
export interface CodeTestStageConfig {
  challengeId?: string;
  languages?: string[];
  timeLimitMinutes?: number;
  maxTestRuns?: number;
}

/** Etapa CODE_TEST pronta para publicar: desafio, linguagens e tempo definidos. */
export function isCodeTestConfigComplete(config: unknown): boolean {
  const c = (config ?? {}) as CodeTestStageConfig;
  return Boolean(c.challengeId && Array.isArray(c.languages) && c.languages.length > 0 && c.timeLimitMinutes);
}

/** Código inicial do editor — lê da entrada padrão e escreve na saída padrão. */
export const STARTER_CODE: Record<string, string> = {
  python: "import sys\n\ndef main():\n    data = sys.stdin.read()\n    # escreva sua solução aqui\n    print(data.strip())\n\nmain()\n",
  javascript:
    "const input = require('fs').readFileSync(0, 'utf8');\n// escreva sua solução aqui\nconsole.log(input.trim());\n",
  typescript:
    "declare const require: any;\nconst input: string = require('fs').readFileSync(0, 'utf8');\n// escreva sua solução aqui\nconsole.log(input.trim());\n",
  java: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // escreva sua solução aqui\n    }\n}\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // escreva sua solução aqui\n    return 0;\n}\n",
  go: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t// escreva sua solução aqui\n\tfmt.Println()\n}\n",
};

/** Resultado de um caso de teste, como as telas o recebem. */
export type CaseOutcome = "PASSED" | "FAILED" | "TIME_LIMIT" | "COMPILE_ERROR" | "RUNTIME_ERROR";

export const CASE_OUTCOME_LABEL: Record<CaseOutcome, string> = {
  PASSED: "Passou",
  FAILED: "Saída diferente da esperada",
  TIME_LIMIT: "Tempo limite excedido",
  COMPILE_ERROR: "Erro de compilação",
  RUNTIME_ERROR: "Erro de execução",
};

/** "1 caso visível", "3 casos ocultos": plural de verdade, sem "caso(s)". */
export function casesLabel(count: number, kind: "visible" | "hidden"): string {
  if (kind === "visible") return `${count} ${count === 1 ? "caso visível" : "casos visíveis"}`;
  return `${count} ${count === 1 ? "caso oculto" : "casos ocultos"}`;
}
