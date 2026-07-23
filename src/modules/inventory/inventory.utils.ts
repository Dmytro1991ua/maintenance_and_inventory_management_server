import { Prisma } from "../../generated/prisma/client";
import type { InventoryCategory } from "./inventory.schemas";

const normalizeSearch = (search?: string): string | undefined => {
  const normalizedSearch = search?.trim();

  return normalizedSearch || undefined;
};

// Builds a raw SQL WHERE clause from a pre-built condition fragment plus
// optional search and category filters. Used for any query that requires
// column-to-column comparisons (which Prisma ORM cannot express).
export const buildRawWhere = (
  condition: Prisma.Sql,
  search?: string,
  category?: InventoryCategory,
): Prisma.Sql => {
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
    ${condition}
    ${searchClause}
    ${categoryClause}
  `;
};

export const buildLowStockMessage = (
  name: string,
  quantity: number,
  minStockLevel: number,
): string =>
  quantity === 0
    ? `Out of stock: "${name}" has 0 units remaining (minimum: ${minStockLevel}).`
    : `Low stock alert: "${name}" has ${quantity} units remaining (minimum: ${minStockLevel}).`;

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
