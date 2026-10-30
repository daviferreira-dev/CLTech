// Rotação da ENCRYPTION_KEY (M4). Passos no README, seção "Trocar a ENCRYPTION_KEY".
//   pnpm db:reencrypt
import { prisma } from "@/lib/prisma";
import { reencryptAll } from "@/server/reencrypt";

if (!process.env.ENCRYPTION_KEY_PREVIOUS) {
  console.error("Defina ENCRYPTION_KEY_PREVIOUS (a chave antiga) e ENCRYPTION_KEY (a nova) antes de rodar.");
  process.exit(1);
}

console.log("Re-cifrados:", await reencryptAll());
await prisma.$disconnect();
