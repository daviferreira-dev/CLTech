-- Vínculo de conta externa comprovado por OAuth (GitHub/LinkedIn). Null = não verificado.
ALTER TABLE "ExternalAccount" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "ExternalAccount" ADD COLUMN "verifiedName" TEXT;
