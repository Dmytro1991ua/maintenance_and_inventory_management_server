-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notificationPreferences" JSONB NOT NULL DEFAULT '{}';
