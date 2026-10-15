import { PrismaClient } from "@prisma/client";

// Evita múltiplas instâncias do client em hot-reload do Next.js dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
