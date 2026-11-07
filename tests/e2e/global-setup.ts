// F5: localmente toda requisição vem do mesmo IP (::1) e a suíte faz mais cadastros do que o
// limite por IP aceita. Zera o RateLimit antes de rodar — só em banco local, nunca em outro host.
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) return;
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "RateLimit";');
  } finally {
    await prisma.$disconnect();
  }
}
