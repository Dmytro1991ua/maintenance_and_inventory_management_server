import { Prisma } from "../../generated/prisma/client";
import { LOW_STOCK_CONDITION } from "./inventory.constants";
import type { InventoryCategory } from "./inventory.schemas";

const normalizeSearch = (search?: string): string | undefined => {
  const normalizedSearch = search?.trim();

  return normalizedSearch || undefined;
};

/**
 * Builds the raw SQL WHERE clause for low-stock queries.
 * Extracted to avoid duplicating SQL between data fetch and count queries.
 */
export const buildLowStockWhere = (search?: string, category?: InventoryCategory): Prisma.Sql => {
  const normalizedSearch = normalizeSearch(search);

  const searchClause = normalizedSearch
    ? Prisma.sql`
        AND (
          name ILIKE ${`%${normalizedSearch}%`}
          OR "serialNumber" ILIKE ${`%${normalizedSearch}%`}
        )
      `
    : Prisma.sql``;

  const categoryClause = category
    ? Prisma.sql`AND category = ${category}::"InventoryCategory"`
    : Prisma.sql``;

  return Prisma.sql`
    ${LOW_STOCK_CONDITION}
    ${searchClause}
    ${categoryClause}
  `;
};

/**
 * Builds the Prisma WHERE input for normal (non-lowStock) queries.
 * Returns undefined when no filters are active so Prisma applies no WHERE filter.
 */
export const buildInventoryWhere = (
  search?: string,
  category?: InventoryCategory,
): Prisma.InventoryItemWhereInput | undefined => {
  const normalizedSearch = normalizeSearch(search);

  if (!normalizedSearch && !category) return undefined;

  return {
    ...(category && { category }),
    ...(normalizedSearch && {
      OR: [
        { name: { contains: normalizedSearch, mode: "insensitive" } },
        { serialNumber: { contains: normalizedSearch, mode: "insensitive" } },
      ],
    }),
  };
};
