-- CreateEnum
CREATE TYPE "DowntimeReason" AS ENUM ('BREAKDOWN', 'PLANNED');

-- CreateTable
CREATE TABLE "asset_downtimes" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "taskId" TEXT,
    "reason" "DowntimeReason" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_downtimes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_downtimes_assetId_startedAt_idx" ON "asset_downtimes"("assetId", "startedAt");

-- AddForeignKey
ALTER TABLE "asset_downtimes" ADD CONSTRAINT "asset_downtimes_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_downtimes" ADD CONSTRAINT "asset_downtimes_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_downtimes" ADD CONSTRAINT "asset_downtimes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
