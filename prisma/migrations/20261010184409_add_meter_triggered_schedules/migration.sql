-- CreateEnum
CREATE TYPE "ScheduleTrigger" AS ENUM ('TIME', 'METER');

-- AlterTable
ALTER TABLE "recurring_tasks" ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "firstDueReading" INTEGER,
ADD COLUMN     "intervalReading" INTEGER,
ADD COLUMN     "meterId" TEXT,
ADD COLUMN     "nextDueReading" INTEGER,
ADD COLUMN     "triggerType" "ScheduleTrigger" NOT NULL DEFAULT 'TIME',
ALTER COLUMN "intervalDays" DROP NOT NULL,
ALTER COLUMN "nextDueAt" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "recurring_tasks_meterId_idx" ON "recurring_tasks"("meterId");

-- AddForeignKey
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A schedule has exactly one trigger style, with all of that style's fields set
-- and none of the other's. Prisma can't express a CHECK, so it lives here. Existing
-- rows are all TIME with both fields set (they were NOT NULL until now).
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_one_trigger" CHECK (
  (
    "triggerType" = 'TIME'
    AND "intervalDays" IS NOT NULL AND "nextDueAt" IS NOT NULL
    AND "meterId" IS NULL AND "intervalReading" IS NULL
    AND "firstDueReading" IS NULL AND "nextDueReading" IS NULL
  )
  OR
  (
    "triggerType" = 'METER'
    AND "meterId" IS NOT NULL AND "intervalReading" > 0
    AND "firstDueReading" IS NOT NULL AND "nextDueReading" IS NOT NULL
    AND "intervalDays" IS NULL AND "nextDueAt" IS NULL
  )
);
