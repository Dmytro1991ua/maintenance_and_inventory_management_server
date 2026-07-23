-- Backfill: reclassify LOW_STOCK notifications for zero-quantity items as OUT_OF_STOCK.
-- Safe to run multiple times — WHERE clause is idempotent.
UPDATE notifications
SET type = 'OUT_OF_STOCK'
WHERE type = 'LOW_STOCK'
  AND "relatedEntityId" IN (
    SELECT id FROM inventory_items WHERE quantity = 0
  );