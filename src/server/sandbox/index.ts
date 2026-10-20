// Execução isolada de código do candidato (spec 005 FR-208 / RNF06 / R10).
//
// O sandbox é Judge0 numa VM à parte (Oracle Cloud Always Free), nunca a própria Vercel:
// serverless não isola contêiner, CPU, memória nem rede. Aqui fica só o cliente HTTP. Sem
// SANDBOX_URL configurada, todo pedido falha como indisponibilidade de infraestrutura — e a
// tela degrada para "correção em andamento" (NFR-202) em vez de quebrar.

import type { CaseOutcome } from "@/lib/codeTest";
import { MAX_CASE_TIME_LIMIT_SECONDS } from "@/lib/codeTest";

export interface SandboxRunInput {
  language: string;
  sourceCode: string;
  stdin: string;
  timeLimitSeconds: number;
}

export interface SandboxRunResult {
  outcome: Exclude<CaseOutcome, "PASSED" | "FAILED"> | "OK";
  stdout: string;
  /** Saída de compilação ou stderr — só é mostrada ao candidato em casos visíveis. */
  diagnostics: string;
}

export interface Sandbox {
  run(input: SandboxRunInput): Promise<SandboxRunResult>;
}

/** Falha da infraestrutura (VM fora do ar, timeout de rede, erro interno do Judge0). */
export class SandboxUnavailableError extends Error {
  constructor(message = "Ambiente de execução indisponível.") {
    super(message);
    this.name = "SandboxUnavailableError";
  }
}

// Ids de linguagem do Judge0 CE.
const JUDGE0_LANGUAGE_ID: Record<string, number> = {
  python: 71,
  javascript: 63,
  typescript: 74,
  java: 62,
  cpp: 54,
  go: 60,
};

const HTTP_TIMEOUT_MS = 30_000;
const MEMORY_LIMIT_KB = 128_000;

interface Judge0Response {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: { id: number; description: string };
}

function decode(value: string | null): string {
  return value ? Buffer.from(value, "base64").toString("utf8") : "";
}

export class Judge0Sandbox implements Sandbox {
  constructor(
    private readonly baseUrl: string,
    private readonly token?: string,
  ) {}

  async run(input: SandboxRunInput): Promise<SandboxRunResult> {
    const languageId = JUDGE0_LANGUAGE_ID[input.language];
    if (!languageId) throw new SandboxUnavailableError(`Linguagem não suportada pelo sandbox: ${input.language}`);
    const cpuLimit = Math.min(Math.max(input.timeLimitSeconds, 1), MAX_CASE_TIME_LIMIT_SECONDS);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/submissions?base64_encoded=true&wait=true`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { "X-Auth-Token": this.token } : {}),
        },
        body: JSON.stringify({
          language_id: languageId,
          source_code: Buffer.from(input.sourceCode, "utf8").toString("base64"),
          stdin: Buffer.from(input.stdin, "utf8").toString("base64"),
          cpu_time_limit: cpuLimit,
          wall_time_limit: cpuLimit + 5,
          memory_limit: MEMORY_LIMIT_KB,
          enable_network: false,
        }),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
    } catch (err) {
      throw new SandboxUnavailableError(`Sandbox inacessível: ${(err as Error).message}`);
    }
    if (!res.ok) throw new SandboxUnavailableError(`Sandbox respondeu ${res.status}.`);

    const body = (await res.json()) as Judge0Response;
    const stdout = decode(body.stdout);
    const diagnostics = decode(body.compile_output) || decode(body.stderr) || (body.message ?? "");

    // https://ce.judge0.com/#statuses-and-languages
    switch (body.status.id) {
      case 3: // Accepted (sem expected_output: execução terminou normalmente)
      case 4: // Wrong Answer
        return { outcome: "OK", stdout, diagnostics };
      case 5:
        return { outcome: "TIME_LIMIT", stdout, diagnostics };
      case 6:
        return { outcome: "COMPILE_ERROR", stdout, diagnostics };
      case 7:
      case 8:
      case 9:
      case 10:
      case 11:
      case 12:
        return { outcome: "RUNTIME_ERROR", stdout, diagnostics };
      default:
        // 1/2 (fila — não deveria ocorrer com wait=true), 13 Internal Error, 14 Exec Format Error.
        throw new SandboxUnavailableError(`Sandbox devolveu status ${body.status.id} (${body.status.description}).`);
    }
  }
}

class UnconfiguredSandbox implements Sandbox {
  async run(): Promise<SandboxRunResult> {
    throw new SandboxUnavailableError("SANDBOX_URL não configurada — VM do Judge0 ainda não provisionada.");
  }
}

let override: Sandbox | null = null;

export function getSandbox(): Sandbox {
  if (override) return override;
  const url = process.env.SANDBOX_URL;
  return url ? new Judge0Sandbox(url, process.env.SANDBOX_TOKEN) : new UnconfiguredSandbox();
}

/** Só para testes: injeta um sandbox falso. `null` restaura o real. */
export function setSandboxForTesting(sandbox: Sandbox | null): void {
  override = sandbox;
}
