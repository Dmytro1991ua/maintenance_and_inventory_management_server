import { Prisma } from "../../generated/prisma/client";

/**
 * Builds the raw SQL WHERE clause for low-stock queries.
 * Extracted to avoid duplicating SQL between data fetch and count queries.
 */
export const buildLowStockWhere = (search?: string): Prisma.Sql => {
  const searchClause = search
    ? Prisma.sql`
        AND (
          name ILIKE ${"%" + search + "%"}
          OR "serialNumber" ILIKE ${"%" + search + "%"}
        )
      `
    : Prisma.sql``;

  // Quoted identifiers — see INVENTORY_SQL_SELECT for why (no @map → camelCase columns).
  return Prisma.sql`
    quantity < "minStockLevel"
    ${searchClause}
  `;
};

/**
 * Builds the Prisma WHERE input for normal (non-lowStock) queries.
 * Returns undefined when no filters are active — Prisma treats
 * undefined as "no filter", which is more efficient than an empty object.
 */
export const buildInventoryWhere = (
  search?: string,
): Prisma.InventoryItemWhereInput | undefined => {
  if (!search) return undefined;

  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { serialNumber: { contains: search, mode: "insensitive" } },
    ],
  };
};
