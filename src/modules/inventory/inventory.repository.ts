import { prisma } from "../../config";
import { Prisma } from "../../generated/prisma/client";
import { getSkipValue, getTotalPages, resolveSortField } from "../../utils";
import {
  INVENTORY_ENTITY_ALLOWED_SORT_FIELDS,
  INVENTORY_ENTITY_DEFAULT_SORT_FIELD,
  INVENTORY_SELECT,
  INVENTORY_SQL_SELECT,
  LOW_STOCK_CONDITION,
} from "./inventory.constants";
import { CreateInventoryItem, InventoryQuery, UpdateInventoryItem } from "./inventory.schemas";
import type { InventoryItemDTO } from "./inventory.types";
import { buildInventoryWhere, buildLowStockWhere } from "./inventory.utils";

export const inventoryRepository = {
  findAll: async (query: InventoryQuery) => {
    const { page, limit, sortBy, sortOrder, search, lowStock } = query;

    const field = resolveSortField(
      sortBy,
      INVENTORY_ENTITY_ALLOWED_SORT_FIELDS,
      INVENTORY_ENTITY_DEFAULT_SORT_FIELD,
    );
    const skip = getSkipValue(page, limit);

    // Low stock = quantity < minStockLevel (same-row comparison).
    // Prisma can't compare two columns, so raw SQL is used here.
    // API contract unchanged: frontend only sends lowStock=true via params.
    if (lowStock) {
      const where = buildLowStockWhere(search);

      const [items, countResult] = await Promise.all([
        prisma.$queryRaw<InventoryItemDTO[]>`
          SELECT ${INVENTORY_SQL_SELECT}
          FROM inventory_items
          WHERE ${where}
          ORDER BY ${Prisma.raw(`"${field}"`)} ${Prisma.raw(sortOrder)}
          LIMIT ${limit}
          OFFSET ${skip}
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) AS count
          FROM inventory_items
          WHERE ${where}
        `,
      ]);

      const total = Number(countResult[0].count);

      return {
        data: items,
        meta: { total, page, limit, pages: getTotalPages(total, limit) },
      };
    }

    const where = buildInventoryWhere(search);

    const [total, items] = await Promise.all([
      prisma.inventoryItem.count({ where }),
      prisma.inventoryItem.findMany({
        where,
        select: INVENTORY_SELECT,
        orderBy: { [field]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, pages: getTotalPages(total, limit) },
    };
  },
  findById: async (id: string) =>
    prisma.inventoryItem.findUnique({
      where: { id },
      select: INVENTORY_SELECT,
    }),
  findBySerialNumber: async (serialNumber: string) =>
    prisma.inventoryItem.findUnique({
      where: { serialNumber },
      select: { id: true },
    }),
  // Unpaginated — used by the low-stock notification job, which needs every
  // matching item in one pass rather than a UI page at a time.
  findLowStock: async (): Promise<InventoryItemDTO[]> =>
    prisma.$queryRaw<InventoryItemDTO[]>`
      SELECT ${INVENTORY_SQL_SELECT}
      FROM inventory_items
      WHERE ${LOW_STOCK_CONDITION}
    `,
  create: async (data: CreateInventoryItem) =>
    prisma.inventoryItem.create({
      data,
      select: INVENTORY_SELECT,
    }),
  update: async (id: string, data: UpdateInventoryItem) =>
    prisma.inventoryItem.update({
      where: { id },
      data,
      select: INVENTORY_SELECT,
    }),
  delete: async (id: string): Promise<void> => {
    await prisma.inventoryItem.delete({ where: { id } });
  },
};
