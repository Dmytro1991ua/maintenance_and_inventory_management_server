-- CreateEnum
CREATE TYPE "ChangeLogAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "ChangeLogEntity" AS ENUM ('ASSET', 'ASSET_DOWNTIME', 'TASK', 'TASK_TIME_ENTRY', 'RECURRING_TASK', 'USER', 'INVENTORY_ITEM');

-- CreateTable
CREATE TABLE "change_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorLabel" TEXT,
    "action" "ChangeLogAction" NOT NULL,
    "entityType" "ChangeLogEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "change_logs_entityType_entityId_createdAt_idx" ON "change_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "change_logs_userId_createdAt_idx" ON "change_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "change_logs_createdAt_idx" ON "change_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
