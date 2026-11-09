-- CreateEnum
CREATE TYPE "RejectionReason" AS ENUM ('TECHNICAL_SKILLS', 'CODE_TEST_SCORE', 'INTERVIEW_PERFORMANCE', 'REQUIREMENTS_NOT_MET', 'POSITION_FILLED', 'JOB_CLOSED', 'NO_RESPONSE', 'OTHER');

-- CreateEnum
CREATE TYPE "InterviewRecommendation" AS ENUM ('ADVANCE', 'UNSURE', 'REJECT');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "rejectionFeedback" TEXT,
ADD COLUMN     "rejectionReason" "RejectionReason";

-- CreateTable
CREATE TABLE "InterviewEvaluation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "evaluatorUserId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "comment" TEXT,
    "recommendation" "InterviewRecommendation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewEvaluation_applicationId_stageId_evaluatorUserId_key" ON "InterviewEvaluation"("applicationId", "stageId", "evaluatorUserId");

-- AddForeignKey
ALTER TABLE "InterviewEvaluation" ADD CONSTRAINT "InterviewEvaluation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewEvaluation" ADD CONSTRAINT "InterviewEvaluation_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProcessStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewEvaluation" ADD CONSTRAINT "InterviewEvaluation_evaluatorUserId_fkey" FOREIGN KEY ("evaluatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS ligado como em todas as tabelas de produção. O app usa o dono do banco, que ignora o
-- RLS; sem política nenhuma, quem acessar pela API pública do Supabase não lê nada daqui.
ALTER TABLE "InterviewEvaluation" ENABLE ROW LEVEL SECURITY;
