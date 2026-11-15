-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hourlyRate" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "task_time_entries" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "minutes" INTEGER NOT NULL,
    "workedOn" DATE NOT NULL,
    "note" TEXT,
    "hourlyRate" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_time_entries_taskId_workedOn_idx" ON "task_time_entries"("taskId", "workedOn");

-- CreateIndex
CREATE INDEX "task_time_entries_userId_idx" ON "task_time_entries"("userId");

-- AddForeignKey
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_time_entries" ADD CONSTRAINT "task_time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
