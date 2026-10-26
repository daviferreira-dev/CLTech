-- Marca quando a correção começou: permite reenfileirar submissão presa em RUNNING ou em ERROR.
ALTER TABLE "CodeSubmission" ADD COLUMN "gradingStartedAt" TIMESTAMP(3);
