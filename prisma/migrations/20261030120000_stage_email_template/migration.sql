-- Assunto e corpo do e-mail que o recrutador monta para cada etapa de entrevista.
ALTER TABLE "ProcessStage" ADD COLUMN "emailSubject" TEXT;
ALTER TABLE "ProcessStage" ADD COLUMN "emailBody" TEXT;
