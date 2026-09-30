import type { InventoryCategory } from "../../generated/prisma/client";

// Dedicated DTO for raw SQL results — keeps the $queryRaw generic in sync
// with INVENTORY_SQL_SELECT. If the schema changes, update this type and
// the SQL projection together.
export type InventoryItemDTO = {
  id: string;
  name: string;
  serialNumber: string;
  category: InventoryCategory;
  quantity: number;
  minStockLevel: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  supplier: string | null;
  // Cast to text in the raw SELECT, so it arrives as a 2-decimal string ("8.50").
  unitCost: string | null;
  createdAt: Date;
  updatedAt: Date;
};
