// Dedicated DTO for raw SQL results — keeps the $queryRaw generic in sync
// with INVENTORY_SQL_SELECT. If the schema changes, update this type and
// the SQL projection together.
export type InventoryItemDTO = {
  id: string;
  name: string;
  serialNumber: string;
  quantity: number;
  minStockLevel: number;
  createdAt: Date;
  updatedAt: Date;
};
