-- CreateEnum
CREATE TYPE "ReorderStatus" AS ENUM ('PENDING', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REORDER_RAISED';

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "reorderPoint" INTEGER,
ADD COLUMN     "reorderQuantity" INTEGER,
ADD COLUMN     "supplier" TEXT;

-- CreateTable
CREATE TABLE "reorders" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "status" "ReorderStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" INTEGER NOT NULL,
    "raisedBy" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reorders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reorders_inventoryItemId_idx" ON "reorders"("inventoryItemId");

-- CreateIndex
CREATE INDEX "reorders_status_createdAt_idx" ON "reorders"("status", "createdAt");

-- CreateIndex
-- Race-safe dedup: at most one OPEN (PENDING/ORDERED) reorder per item. Two
-- concurrent raises collide on this partial unique index — one wins, the other
-- gets a unique violation the service treats as "already open". Not expressible
-- in the Prisma schema, so it lives here as raw SQL.
CREATE UNIQUE INDEX "reorders_one_open_per_item"
  ON "reorders" ("inventoryItemId")
  WHERE status IN ('PENDING', 'ORDERED');

-- AddForeignKey
ALTER TABLE "reorders" ADD CONSTRAINT "reorders_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
