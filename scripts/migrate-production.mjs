// Roda no `pnpm build`. Aplica as migrations do Prisma só no build de PRODUÇÃO da Vercel,
// antes do `next build`, para o código novo nunca subir com o banco velho.
// Preview não migra: hoje usa o mesmo banco de produção, e migration de branch lá é pior.
// Fora da Vercel (dev, CI, testes) não faz nada.
import { execSync } from "node:child_process";
import { migrationUrl } from "./migration-url.ts";

const env = process.env.VERCEL_ENV;
if (env !== "production") {
  console.log(`[migrate] pulado (VERCEL_ENV=${env ?? "vazio"}): só o build de produção migra.`);
  process.exit(0);
}

const url = migrationUrl(process.env);
if (!url) {
  console.error(
    "[migrate] Não deu para montar a URL de migração: DIRECT_URL vazia e o DATABASE_URL não é o\n" +
      "pooler do Supabase na porta 6543. O build para aqui (o deploy anterior continua no ar).\n" +
      "Ver docs/deploy-vercel.md, passo 3.",
  );
  process.exit(1);
}

// Nunca logar a URL inteira: tem a senha.
const { hostname, port } = new URL(url);
const origem = process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL (porta trocada para 5432)";
console.log(`[migrate] aplicando migrations em ${hostname}:${port || "5432"} via ${origem}`);

execSync("prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
