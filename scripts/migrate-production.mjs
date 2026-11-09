// Roda no `pnpm build`. Aplica as migrations do Prisma só no build de PRODUÇÃO da Vercel,
// antes do `next build`, para o código novo nunca subir com o banco velho.
// Preview não migra: hoje usa o mesmo banco de produção, e migration de branch lá é pior.
// Fora da Vercel (dev, CI, testes) não faz nada.
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
if (env !== "production") {
  console.log(`[migrate] pulado (VERCEL_ENV=${env ?? "vazio"}): só o build de produção migra.`);
  process.exit(0);
}

// O DATABASE_URL de produção é o pooler em modo transaction (6543), onde o migrate deploy
// pode travar (advisory lock). A migration precisa da conexão direta ou do session pooler (5432).
const url = process.env.DIRECT_URL;
if (!url) {
  console.error(
    "[migrate] DIRECT_URL não configurada em Production na Vercel. Sem ela não dá para aplicar\n" +
      "as migrations, e o build para aqui (o deploy anterior continua no ar).\n" +
      "Ver docs/deploy-vercel.md, passo 3.",
  );
  process.exit(1);
}

execSync("prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
