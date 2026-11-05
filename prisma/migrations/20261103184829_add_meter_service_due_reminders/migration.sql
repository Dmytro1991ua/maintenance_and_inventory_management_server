-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'METER_SERVICE_DUE';

-- AlterTable
ALTER TABLE "recurring_tasks" ADD COLUMN     "reminderSentForReading" INTEGER;
