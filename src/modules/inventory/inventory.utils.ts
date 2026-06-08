import { Prisma } from "../../generated/prisma/client";
import { LOW_STOCK_CONDITION } from "./inventory.constants";

const normalizeSearch = (search?: string): string | undefined => {
  const normalizedSearch = search?.trim();

  return normalizedSearch || undefined;
};

/**
 * Builds the raw SQL WHERE clause for low-stock queries.
 * Extracted to avoid duplicating SQL between data fetch and count queries.
 */
export const buildLowStockWhere = (search?: string): Prisma.Sql => {
  const normalizedSearch = normalizeSearch(search);

  const searchClause = normalizedSearch
    ? Prisma.sql`
        AND (
          name ILIKE ${`%${normalizedSearch}%`}
          OR "serialNumber" ILIKE ${`%${normalizedSearch}%`}
        )
      `
    : Prisma.sql``;

  return Prisma.sql`
    ${LOW_STOCK_CONDITION}
    ${searchClause}
  `;
};

/**
 * Builds the Prisma WHERE input for normal (non-lowStock) queries.
 * Returns undefined when no filters are active so Prisma applies no WHERE filter.
 */
export const buildInventoryWhere = (
  search?: string,
): Prisma.InventoryItemWhereInput | undefined => {
  const normalizedSearch = normalizeSearch(search);

  if (!normalizedSearch) return undefined;

  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { serialNumber: { contains: search, mode: "insensitive" } },
    ],
  };
};
