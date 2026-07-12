import { Prisma } from "../../generated/prisma/client";

export const INVENTORY_CATEGORIES = [
  "ELECTRICAL",
  "PLUMBING",
  "HVAC",
  "TOOLS",
  "FASTENERS",
  "CHEMICALS",
  "SAFETY",
  "BUILDING_MATERIALS",
] as const;

export const INVENTORY_SELECT = {
  id: true,
  name: true,
  serialNumber: true,
  category: true,
  quantity: true,
  minStockLevel: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InventoryItemSelect;

// Centralized column list for the raw low-stock queries — one place to update
// if the schema changes. Columns must be double-quoted: the schema has no
// @map directives, so Postgres stores them as case-sensitive camelCase
// identifiers (e.g. "serialNumber"), not snake_case.
export const INVENTORY_SQL_SELECT = Prisma.sql`
  id,
  name,
  "serialNumber",
  category,
  quantity,
  "minStockLevel",
  "createdAt",
  "updatedAt"
`;

// Single source of truth for "what counts as low stock" — shared by the
// paginated lowStock=true query and the unpaginated job lookup, so the
// definition can't drift between the two.
export const LOW_STOCK_CONDITION = Prisma.sql`quantity < "minStockLevel"`;

export const INVENTORY_ENTITY_ALLOWED_SORT_FIELDS = [
  "name",
  "quantity",
  "category",
  "createdAt",
] as const;

export const INVENTORY_ENTITY_DEFAULT_SORT_FIELD = "createdAt" as const;

export const INVENTORY_ITEM_NOT_FOUND_MESSAGE = "Inventory item not found";
