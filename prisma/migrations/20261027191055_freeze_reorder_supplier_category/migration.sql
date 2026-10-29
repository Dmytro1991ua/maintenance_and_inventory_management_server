-- AlterTable
ALTER TABLE "reorders" ADD COLUMN     "receivedCategory" "InventoryCategory",
ADD COLUMN     "receivedSupplier" TEXT;

-- Backfill: received orders get their item's current supplier and category, the
-- best information available for orders received before these were recorded.
UPDATE "reorders" r
SET "receivedSupplier" = i."supplier",
    "receivedCategory" = i."category"
FROM "inventory_items" i
WHERE i."id" = r."inventoryItemId"
  AND r."status" = 'RECEIVED';
