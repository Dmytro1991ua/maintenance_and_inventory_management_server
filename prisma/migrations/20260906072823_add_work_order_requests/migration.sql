-- CreateEnum
CREATE TYPE "WorkOrderRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "work_order_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "InventoryCategory",
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WorkOrderRequestStatus" NOT NULL DEFAULT 'PENDING',
    "assetId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_order_requests_taskId_key" ON "work_order_requests"("taskId");

-- CreateIndex
CREATE INDEX "work_order_requests_status_createdAt_idx" ON "work_order_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "work_order_requests_requestedBy_idx" ON "work_order_requests"("requestedBy");

-- AddForeignKey
ALTER TABLE "work_order_requests" ADD CONSTRAINT "work_order_requests_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_requests" ADD CONSTRAINT "work_order_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_requests" ADD CONSTRAINT "work_order_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_requests" ADD CONSTRAINT "work_order_requests_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
