-- Data e link da reunião marcada ao entrar numa etapa de entrevista.
ALTER TABLE "ApplicationStageHistory" ADD COLUMN "meetingAt" TIMESTAMP(3);
ALTER TABLE "ApplicationStageHistory" ADD COLUMN "meetingUrl" TEXT;
