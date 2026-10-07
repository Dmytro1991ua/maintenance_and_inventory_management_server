-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WARRANTY_EXPIRING';

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "warrantyExpiresAt" DATE,
ADD COLUMN     "warrantyReminderSentAt" TIMESTAMP(3);
