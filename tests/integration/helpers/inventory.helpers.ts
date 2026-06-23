import { randomUUID } from "node:crypto";

import { prisma } from "../../../src/config";
import type { InventoryItem } from "../../../src/generated/prisma/client";

type CreateTestInventoryItemOptions = Partial<
  Pick<InventoryItem, "name" | "serialNumber" | "quantity" | "minStockLevel">
>;

export const createTestInventoryItem = (
  options: CreateTestInventoryItemOptions = {},
): Promise<InventoryItem> =>
  prisma.inventoryItem.create({
    data: {
      name: options.name ?? "Cordless Drill",
      serialNumber: options.serialNumber ?? `SN-${randomUUID().slice(0, 8)}`,
      quantity: options.quantity ?? 12,
      minStockLevel: options.minStockLevel ?? 5,
    },
  });
