// Execução isolada de código do candidato (spec 005 FR-208 / RNF06 / R10).
//
// O sandbox é Judge0 numa VM à parte (Oracle Cloud Always Free), nunca a própria Vercel:
// serverless não isola contêiner, CPU, memória nem rede. Aqui fica só o cliente HTTP. Sem
// SANDBOX_URL configurada, todo pedido falha como indisponibilidade de infraestrutura — e a
// tela degrada para "correção em andamento" (NFR-202) em vez de quebrar.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

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

interface LocalRuntime {
  file: string;
  /** Passo de compilação (Java/C++/Go). Ausente = linguagem interpretada. */
  compile?: { cmd: string; args: string[] };
  /** Comando que executa o código (ou o binário gerado) dentro do diretório temporário. */
  run: (dir: string) => { cmd: string; args: string[] };
}

const EXE = process.platform === "win32" ? ".exe" : "";

// Toolchains usadas pelo LocalSandbox; a linguagem só é aceita se o comando existir no PATH.
const LOCAL_RUNTIME: Record<string, LocalRuntime> = {
  python: { file: "main.py", run: (dir) => ({ cmd: process.platform === "win32" ? "python" : "python3", args: [join(dir, "main.py")] }) },
  javascript: { file: "main.js", run: (dir) => ({ cmd: process.execPath, args: [join(dir, "main.js")] }) },
  // Node >= 23.6 remove tipos de .ts nativamente (sem enum/namespace).
  typescript: { file: "main.ts", run: (dir) => ({ cmd: process.execPath, args: ["--no-warnings", join(dir, "main.ts")] }) },
  java: {
    file: "Main.java",
    compile: { cmd: "javac", args: ["Main.java"] },
    run: () => ({ cmd: "java", args: ["-Xmx128m", "-cp", ".", "Main"] }),
  },
  cpp: {
    file: "main.cpp",
    compile: { cmd: "g++", args: ["-O2", "-std=c++17", "-o", `main${EXE}`, "main.cpp"] },
    run: (dir) => ({ cmd: join(dir, `main${EXE}`), args: [] }),
  },
  go: {
    file: "main.go",
    compile: { cmd: "go", args: ["build", "-o", `main${EXE}`, "main.go"] },
    run: (dir) => ({ cmd: join(dir, `main${EXE}`), args: [] }),
  },
};

const LOCAL_MAX_OUTPUT_BYTES = 1_000_000;
const COMPILE_TIMEOUT_MS = 60_000;

function commandExists(cmd: string): boolean {
  if (cmd === process.execPath) return true;
  const exts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  return (process.env.PATH ?? "")
    .split(delimiter)
    .some((dir) => dir && exts.some((ext) => existsSync(join(dir, cmd + ext))));
}

interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function exec(cmd: string, args: string[], cwd: string, stdin: string, timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      // Ambiente mínimo: não repassa segredos do .env (DATABASE_URL, chaves) ao código do candidato.
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PATH: process.env.PATH ?? "",
        HOME: tmpdir(), // go build precisa de cache gravável
        GOCACHE: join(tmpdir(), "cltech-go-cache"),
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
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < LOCAL_MAX_OUTPUT_BYTES) stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < LOCAL_MAX_OUTPUT_BYTES) stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new SandboxUnavailableError(`Interpretador indisponível (${cmd}): ${err.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });

    child.stdin.on("error", () => {}); // processo pode sair antes de ler toda a entrada
    child.stdin.end(stdin);
  });
}

/**
 * SÓ PARA DESENVOLVIMENTO (`SANDBOX_URL="local"`): roda o código do candidato direto na
 * máquina, sem isolamento de rede, disco ou memória. Existe para exercitar o fluxo de
 * correção sem a VM do Judge0; recusado em produção.
 */
export class LocalSandbox implements Sandbox {
  supports(language: string): boolean {
    const runtime = LOCAL_RUNTIME[language];
    if (!runtime) return false;
    return commandExists(runtime.compile?.cmd ?? runtime.run("").cmd);
  }

  async run(input: SandboxRunInput): Promise<SandboxRunResult> {
    const runtime = LOCAL_RUNTIME[input.language];
    if (!runtime) throw new SandboxUnavailableError(`Linguagem não suportada pelo sandbox local: ${input.language}`);
    const timeLimitMs = Math.min(Math.max(input.timeLimitSeconds, 1), MAX_CASE_TIME_LIMIT_SECONDS) * 1000;

    const dir = await mkdtemp(join(tmpdir(), "cltech-sandbox-"));
    await writeFile(join(dir, runtime.file), input.sourceCode, "utf8");

    try {
      if (runtime.compile) {
        const built = await exec(runtime.compile.cmd, runtime.compile.args, dir, "", COMPILE_TIMEOUT_MS);
        if (built.timedOut || built.code !== 0) {
          return { outcome: "COMPILE_ERROR", stdout: "", diagnostics: built.stderr || built.stdout };
        }
      }
      const { cmd, args } = runtime.run(dir);
      const res = await exec(cmd, args, dir, input.stdin, timeLimitMs);
      if (res.timedOut) return { outcome: "TIME_LIMIT", stdout: res.stdout, diagnostics: res.stderr };
      if (res.code !== 0) return { outcome: "RUNTIME_ERROR", stdout: res.stdout, diagnostics: res.stderr };
      return { outcome: "OK", stdout: res.stdout, diagnostics: res.stderr };
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
