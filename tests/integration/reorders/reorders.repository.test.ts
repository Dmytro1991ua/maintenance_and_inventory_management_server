import { prisma } from "../../../src/config";
import { reordersRepository } from "../../../src/modules/reorders/reorders.repository";
import { createTestInventoryItem } from "../helpers";

const createReorder = (inventoryItemId: string, status: "PENDING" | "ORDERED" | "CANCELLED") =>
  prisma.reorder.create({ data: { inventoryItemId, quantity: 5, status } });

describe("reordersRepository.findItemsNeedingReorder", () => {
  it("returns items at or below their reorder threshold, excluding those with an open reorder", async () => {
    // Below threshold via the minStockLevel fallback (no reorderPoint set).
    const belowFallback = await createTestInventoryItem({
      quantity: 2,
      minStockLevel: 5,
    });
    // Exactly at an explicit reorderPoint — the `<=` boundary must include it.
    const atReorderPoint = await createTestInventoryItem({
      quantity: 5,
      minStockLevel: 10,
      reorderPoint: 5,
    });
    // Comfortably above threshold — excluded.
    await createTestInventoryItem({ quantity: 20, minStockLevel: 5 });
    // Below threshold but already has an open reorder — excluded by the anti-join.
    const withPending = await createTestInventoryItem({ quantity: 1, minStockLevel: 5 });
    await createReorder(withPending.id, "PENDING");
    const withOrdered = await createTestInventoryItem({ quantity: 1, minStockLevel: 5 });
    await createReorder(withOrdered.id, "ORDERED");
    // Below threshold with only a CANCELLED reorder — still eligible (not open).
    const withCancelled = await createTestInventoryItem({ quantity: 1, minStockLevel: 5 });
    await createReorder(withCancelled.id, "CANCELLED");

    const items = await reordersRepository.findItemsNeedingReorder();
    const ids = items.map((i) => i.id).sort();

    expect(ids).toEqual([belowFallback.id, atReorderPoint.id, withCancelled.id].sort());
  });

  it("does not raise for an item one unit above its reorder point", async () => {
    // reorderPoint 5, quantity 6 → 6 <= 5 is false, so it must be excluded even
    // though it sits below minStockLevel (guards against a flipped comparison).
    await createTestInventoryItem({ quantity: 6, minStockLevel: 10, reorderPoint: 5 });

    const items = await reordersRepository.findItemsNeedingReorder();

    expect(items).toHaveLength(0);
  });
});
