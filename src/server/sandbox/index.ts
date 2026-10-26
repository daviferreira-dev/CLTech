// Execução isolada de código do candidato (spec 005 FR-208 / RNF06 / R10).
//
// O sandbox é Judge0 numa VM à parte (Oracle Cloud Always Free), nunca a própria Vercel:
// serverless não isola contêiner, CPU, memória nem rede. Aqui fica só o cliente HTTP. Sem
// SANDBOX_URL configurada, todo pedido falha como indisponibilidade de infraestrutura — e a
// tela degrada para "correção em andamento" (NFR-202) em vez de quebrar.

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  /** Se este sandbox consegue rodar a linguagem. Ausente = assume que sim. */
  supports?(language: string): boolean;
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

  supports(language: string): boolean {
    return language in JUDGE0_LANGUAGE_ID;
  }

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

// Interpretadores usados pelo LocalSandbox. Java/C++/Go ficam de fora: exigiriam toolchain
// instalada e passo de compilação, e o Judge0 já cobre isso em produção.
const LOCAL_RUNTIME: Record<string, { ext: string; cmd: string; args: string[] }> = {
  python: { ext: "py", cmd: process.platform === "win32" ? "python" : "python3", args: [] },
  javascript: { ext: "js", cmd: process.execPath, args: [] },
  // Node >= 23.6 remove tipos de .ts nativamente (sem enum/namespace).
  typescript: { ext: "ts", cmd: process.execPath, args: ["--no-warnings"] },
};

const LOCAL_MAX_OUTPUT_BYTES = 1_000_000;

/**
 * SÓ PARA DESENVOLVIMENTO (`SANDBOX_URL="local"`): roda o código do candidato direto na
 * máquina, sem isolamento de rede, disco ou memória. Existe para exercitar o fluxo de
 * correção sem a VM do Judge0; recusado em produção.
 */
export class LocalSandbox implements Sandbox {
  supports(language: string): boolean {
    return language in LOCAL_RUNTIME;
  }

  async run(input: SandboxRunInput): Promise<SandboxRunResult> {
    const runtime = LOCAL_RUNTIME[input.language];
    if (!runtime) throw new SandboxUnavailableError(`Linguagem não suportada pelo sandbox local: ${input.language}`);
    const timeLimitMs = Math.min(Math.max(input.timeLimitSeconds, 1), MAX_CASE_TIME_LIMIT_SECONDS) * 1000;

    const dir = await mkdtemp(join(tmpdir(), "cltech-sandbox-"));
    const file = join(dir, `main.${runtime.ext}`);
    await writeFile(file, input.sourceCode, "utf8");

    try {
      return await new Promise<SandboxRunResult>((resolve, reject) => {
        const child = spawn(runtime.cmd, [...runtime.args, file], {
          cwd: dir,
          // Ambiente mínimo: não repassa segredos do .env (DATABASE_URL, chaves) ao código do candidato.
          env: {
            NODE_ENV: process.env.NODE_ENV,
            PATH: process.env.PATH ?? "",
            SYSTEMROOT: process.env.SYSTEMROOT ?? "",
            PYTHONIOENCODING: "utf-8",
          },
          windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeLimitMs);

        child.stdout.on("data", (chunk: Buffer) => {
          if (stdout.length < LOCAL_MAX_OUTPUT_BYTES) stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk: Buffer) => {
          if (stderr.length < LOCAL_MAX_OUTPUT_BYTES) stderr += chunk.toString("utf8");
        });
        child.on("error", (err) => {
          clearTimeout(timer);
          reject(new SandboxUnavailableError(`Interpretador indisponível (${runtime.cmd}): ${err.message}`));
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          if (timedOut) resolve({ outcome: "TIME_LIMIT", stdout, diagnostics: stderr });
          else if (code !== 0) resolve({ outcome: "RUNTIME_ERROR", stdout, diagnostics: stderr });
          else resolve({ outcome: "OK", stdout, diagnostics: stderr });
        });

        child.stdin.on("error", () => {}); // processo pode sair antes de ler toda a entrada
        child.stdin.end(input.stdin);
      });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

class UnconfiguredSandbox implements Sandbox {
  supports(): boolean {
    return false;
  }

  async run(): Promise<SandboxRunResult> {
    throw new SandboxUnavailableError("SANDBOX_URL não configurada — VM do Judge0 ainda não provisionada.");
  }
}

let override: Sandbox | null = null;

export function getSandbox(): Sandbox {
  if (override) return override;
  const url = process.env.SANDBOX_URL;
  if (url === "local") {
    // Em produção falha como infraestrutura indisponível, igual a SANDBOX_URL vazia — salvo
    // opt-in explícito de quem roda o build na própria máquina (run.bat).
    const allowed = process.env.NODE_ENV !== "production" || process.env.SANDBOX_ALLOW_LOCAL === "1";
    return allowed ? new LocalSandbox() : new UnconfiguredSandbox();
  }
  return url ? new Judge0Sandbox(url, process.env.SANDBOX_TOKEN) : new UnconfiguredSandbox();
}

/**
 * Se dá para corrigir agora uma submissão nesta linguagem. Falso com sandbox não configurado
 * ou linguagem fora do sandbox ativo — submeter assim só terminaria em ERROR.
 */
export function canGrade(language: string): boolean {
  const sandbox = getSandbox();
  return sandbox.supports ? sandbox.supports(language) : true;
}

/** Só para testes: injeta um sandbox falso. `null` restaura o real. */
export function setSandboxForTesting(sandbox: Sandbox | null): void {
  override = sandbox;
}
