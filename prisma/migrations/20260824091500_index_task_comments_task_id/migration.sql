-- CreateIndex
CREATE INDEX "task_comments_taskId_createdAt_idx" ON "task_comments"("taskId", "createdAt");
