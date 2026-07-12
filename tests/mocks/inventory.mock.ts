import { InventoryItem } from "../../src/generated/prisma/client";

export const buildInventoryItem = (overrides: Partial<InventoryItem> = {}) => ({
  id: "item-1",
  name: "Cordless Drill",
  serialNumber: "SN-00123",
  category: "TOOLS" as InventoryItem["category"],
  quantity: 12,
  minStockLevel: 5,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});
