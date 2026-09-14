-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TASK_DUE_SOON';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
