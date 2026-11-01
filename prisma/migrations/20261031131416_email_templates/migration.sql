-- CreateEnum
CREATE TYPE "EmailMoment" AS ENUM ('APPLICATION_RECEIVED', 'STAGE_ADVANCED_RESUME_ANALYSIS', 'STAGE_ADVANCED_CODE_TEST', 'STAGE_ADVANCED_GITHUB_ANALYSIS', 'STAGE_ADVANCED_HR_INTERVIEW', 'STAGE_ADVANCED_TECH_INTERVIEW', 'STAGE_ADVANCED_FINAL_OFFER', 'REJECTED', 'APPROVED', 'JOB_CLOSED');

-- CreateEnum
CREATE TYPE "StageEmailMode" AS ENUM ('DEFAULT', 'TEMPLATE', 'CUSTOM', 'OFF');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "approvedEmailBody" TEXT,
ADD COLUMN     "approvedEmailMode" "StageEmailMode" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "approvedEmailSubject" TEXT,
ADD COLUMN     "approvedEmailTemplateId" TEXT,
ADD COLUMN     "rejectedEmailBody" TEXT,
ADD COLUMN     "rejectedEmailMode" "StageEmailMode" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "rejectedEmailSubject" TEXT,
ADD COLUMN     "rejectedEmailTemplateId" TEXT;

-- AlterTable
ALTER TABLE "ProcessStage" ADD COLUMN     "emailMode" "StageEmailMode" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "emailTemplateId" TEXT;

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "defaultFor" "EmailMoment",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_defaultFor_key" ON "EmailTemplate"("defaultFor");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_rejectedEmailTemplateId_fkey" FOREIGN KEY ("rejectedEmailTemplateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_approvedEmailTemplateId_fkey" FOREIGN KEY ("approvedEmailTemplateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStage" ADD CONSTRAINT "ProcessStage_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Modelo padrão de cada momento (src/lib/emailMoments.ts: DEFAULT_EMAIL_TEMPLATES). Um por
-- EmailMoment, sempre presente (resolve.ts cai aqui quando a vaga usa "padrão" ou não
-- configurou o momento) — reproduz o e-mail atual onde já existia um.
INSERT INTO "EmailTemplate" ("id", "name", "subject", "body", "defaultFor", "updatedAt") VALUES
('e1aa0001-0000-4000-8000-000000000001', 'Candidatura recebida', 'Recebemos sua candidatura — {{vaga}}', 'Recebemos sua candidatura para a vaga {{vaga}} na {{empresa}}. Nossa equipe vai analisar e avisamos por aqui sobre os próximos passos.', 'APPLICATION_RECEIVED', CURRENT_TIMESTAMP),
('e1aa0001-0000-4000-8000-000000000002', 'Avançou — Análise de Currículo', 'Você avançou para {{etapa}} — {{vaga}}', 'Você passou para a próxima etapa do processo seletivo da vaga {{vaga}}.', 'STAGE_ADVANCED_RESUME_ANALYSIS', CURRENT_TIMESTAMP),
('e1aa0001-0000-4000-8000-000000000003', 'Teste de código liberado', 'Você avançou para {{etapa}} — {{vaga}}', E'Seu teste de código para a vaga {{vaga}} já está liberado. Você tem até {{prazo}} para concluir, em uma tentativa única — reserve um tempo tranquilo antes de começar.\nAcesse por aqui: {{link_teste}}', 'STAGE_ADVANCED_CODE_TEST', CURRENT_TIMESTAMP),
('e1aa0001-0000-4000-8000-000000000004', 'Avançou — Análise de GitHub', 'Você avançou para {{etapa}} — {{vaga}}', 'Você passou para a próxima etapa do processo seletivo da vaga {{vaga}}.', 'STAGE_ADVANCED_GITHUB_ANALYSIS', CURRENT_TIMESTAMP),
('e1aa0001-0000-4000-8000-000000000005', 'Avançou — Entrevista de RH', 'Você avançou para {{etapa}} — {{vaga}}', 'Você passou para a próxima etapa do processo seletivo da vaga {{vaga}}.', 'STAGE_ADVANCED_HR_INTERVIEW', CURRENT_TIMESTAMP),
('e1aa0001-0000-4000-8000-000000000006', 'Avançou — Entrevista Técnica', 'Você avançou para {{etapa}} — {{vaga}}', 'Você passou para a próxima etapa do processo seletivo da vaga {{vaga}}.', 'STAGE_ADVANCED_TECH_INTERVIEW', CURRENT_TIMESTAMP),
('e1aa0001-0000-4000-8000-000000000007', 'Avançou — Proposta Final', 'Você avançou para {{etapa}} — {{vaga}}', 'Você passou para a próxima etapa do processo seletivo da vaga {{vaga}}.', 'STAGE_ADVANCED_FINAL_OFFER', CURRENT_TIMESTAMP),
('e1aa0001-0000-4000-8000-000000000008', 'Reprovado', 'Atualização sobre sua candidatura — {{vaga}}', 'Obrigado por participar do processo seletivo da vaga {{vaga}}. Depois de uma análise cuidadosa, decidimos não seguir com a sua candidatura neste momento.', 'REJECTED', CURRENT_TIMESTAMP),
('e1aa0001-0000-4000-8000-000000000009', 'Aprovado / contratado', 'Você foi aprovado(a) na vaga {{vaga}}! 🎉', 'Você foi aprovado(a) no processo seletivo da vaga {{vaga}}. Foi uma jornada e tanto — obrigado por cada etapa.', 'APPROVED', CURRENT_TIMESTAMP),
('e1aa0001-0000-4000-8000-000000000010', 'Vaga encerrada', 'Atualização sobre sua candidatura — {{vaga}}', 'Obrigado por participar do processo seletivo da vaga {{vaga}}. Ela foi encerrada, e por isso sua candidatura também foi encerrada.', 'JOB_CLOSED', CURRENT_TIMESTAMP);
