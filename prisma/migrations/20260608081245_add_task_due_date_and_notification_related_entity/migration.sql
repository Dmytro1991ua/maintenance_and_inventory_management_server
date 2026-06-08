-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "relatedEntityId" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "dueDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notifications_type_relatedEntityId_isRead_idx" ON "notifications"("type", "relatedEntityId", "isRead");
