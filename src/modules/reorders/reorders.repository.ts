import { prisma } from "../../config";
import { Prisma, ReorderStatus } from "../../generated/prisma/client";
import { getSkipValue, getTotalPages, resolveSortField } from "../../utils";
import {
  REORDER_ENTITY_ALLOWED_SORT_FIELDS,
  REORDER_ENTITY_DEFAULT_SORT_FIELD,
  REORDER_SELECT,
} from "./reorders.constants";
import type { ReordersQuery } from "./reorders.schemas";

export type ItemNeedingReorder = {
  id: string;
  name: string;
  quantity: number;
  minStockLevel: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  // Cast to text in the raw SELECT, so it arrives as a 2-decimal string ("8.50").
  unitCost: string | null;
};

type RaiseInput = {
  inventoryItemId: string;
  quantity: number;
  raisedBy: string | null;
  // Snapshot of the item's unitCost at raise time; null when the item is unpriced.
  unitCostAtRaise: string | null;
};

const buildWhere = (
  status: ReordersQuery["status"],
  inventoryItemId?: string,
): Prisma.ReorderWhereInput | undefined => {
  if (!status && !inventoryItemId) return undefined;

  return {
    ...(status && { status }),
    ...(inventoryItemId && { inventoryItemId }),
  };
};

export const reordersRepository = {
  findAll: async (query: ReordersQuery) => {
    const { page, limit, sortBy, sortOrder, status, inventoryItemId } = query;

    const field = resolveSortField(
      sortBy,
      REORDER_ENTITY_ALLOWED_SORT_FIELDS,
      REORDER_ENTITY_DEFAULT_SORT_FIELD,
    );
    const skip = getSkipValue(page, limit);
    const where = buildWhere(status, inventoryItemId);

    const [total, data] = await Promise.all([
      prisma.reorder.count({ where }),
      prisma.reorder.findMany({
        where,
        select: REORDER_SELECT,
        orderBy: { [field]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return { data, meta: { total, page, limit, pages: getTotalPages(total, limit) } };
  },

  findById: (id: string) => prisma.reorder.findUnique({ where: { id }, select: REORDER_SELECT }),
  // Inserts a PENDING reorder. The partial unique index
  // (reorders_one_open_per_item) enforces at most one open reorder per item —
  // a concurrent raise loses the race here with a P2002 the caller translates.
  raise: ({ inventoryItemId, quantity, raisedBy, unitCostAtRaise }: RaiseInput) =>
    prisma.reorder.create({
      data: { inventoryItemId, quantity, raisedBy, unitCostAtRaise },
      select: REORDER_SELECT,
    }),
  // Guarded PENDING → ORDERED. The conditional updateMany is the real race
  // guard: only a row still PENDING transitions, so a lost race yields count 0.
  markOrdered: async (id: string, reviewedBy: string) => {
    const { count } = await prisma.reorder.updateMany({
      where: { id, status: ReorderStatus.PENDING },
      data: { status: ReorderStatus.ORDERED, reviewedBy },
    });

    if (count === 0) return null;

    return prisma.reorder.findUnique({ where: { id }, select: REORDER_SELECT });
  },
  // Guarded open → CANCELLED (from PENDING or ORDERED). Cancelling reopens the
  // reorder loop for the item — the partial index no longer sees an open row.
  cancel: async (id: string, reviewedBy: string) => {
    const { count } = await prisma.reorder.updateMany({
      where: {
        id,
        status: { in: [ReorderStatus.PENDING, ReorderStatus.ORDERED] },
      },
      data: { status: ReorderStatus.CANCELLED, reviewedBy },
    });

    if (count === 0) return null;

    return prisma.reorder.findUnique({ where: { id }, select: REORDER_SELECT });
  },
  // Guarded ORDERED → RECEIVED plus the stock increment, in one transaction.
  // The conditional updateMany guarantees exactly one caller transitions the
  // row, so the increment can't be applied twice by concurrent receives.
  receive: (id: string, reviewedBy: string, receivedUnitCost: string | null) =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.reorder.updateMany({
        where: { id, status: ReorderStatus.ORDERED },
        data: {
          status: ReorderStatus.RECEIVED,
          reviewedBy,
          receivedAt: new Date(),
          receivedUnitCost,
        },
      });

      if (count === 0) return null;

      const { inventoryItemId, quantity } = await tx.reorder.findUniqueOrThrow({
        where: { id },
        select: { inventoryItemId: true, quantity: true },
      });

      await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { quantity: { increment: quantity } },
      });

      // Re-read after the increment so the returned inventoryItem.quantity
      // reflects the restocked total.
      return tx.reorder.findUniqueOrThrow({ where: { id }, select: REORDER_SELECT });
    }),
  // Items at or below their reorder threshold (reorderPoint, falling back to
  // minStockLevel) that have no open reorder yet. Column-to-column comparison
  // and the NOT EXISTS anti-join can't be expressed in the Prisma query API.
  findItemsNeedingReorder: (): Promise<ItemNeedingReorder[]> =>
    prisma.$queryRaw<ItemNeedingReorder[]>`
      SELECT
        i.id,
        i.name,
        i.quantity,
        i."minStockLevel",
        i."reorderPoint",
        i."reorderQuantity",
        i."unitCost"::text AS "unitCost"
      FROM inventory_items i
      WHERE i.quantity <= COALESCE(i."reorderPoint", i."minStockLevel")
        AND NOT EXISTS (
          SELECT 1 FROM reorders r
          WHERE r."inventoryItemId" = i.id
            AND r.status IN ('PENDING', 'ORDERED')
        )
    `,

  // Purchasing money summary in one pass over all reorders. Every column carries
  // its own status FILTER (no table-wide WHERE), so the open-set and received-set
  // metrics can't bleed into each other:
  //   committed (OPEN = PENDING + ORDERED): committedSpend, openOrders, unpricedOrders
  //   spent     (RECEIVED):                 spent, receivedOrders, unrecordedReceived
  //   variance  (RECEIVED w/ both costs):   variance, comparableOrders
  // Sums stay NUMERIC; costless orders are excluded from totals and counted
  // separately, never treated as $0. Variance = actual − estimate (may be < 0),
  // only over orders that have both numbers (a cross-set subtraction would be
  // meaningless, since committed and spent cover disjoint statuses).
  getStats: async () => {
    const [row] = await prisma.$queryRaw<
      [
        {
          committedSpend: string;
          openOrders: number;
          unpricedOrders: number;
          spent: string;
          receivedOrders: number;
          unrecordedReceived: number;
          variance: string;
          comparableOrders: number;
        },
      ]
    >`
      SELECT
        (COALESCE(SUM(quantity * "unitCostAtRaise") FILTER (WHERE status IN ('PENDING', 'ORDERED') AND "unitCostAtRaise" IS NOT NULL), 0))::numeric(14, 2)::text AS "committedSpend",
        (COUNT(*) FILTER (WHERE status IN ('PENDING', 'ORDERED')))::int                                   AS "openOrders",
        (COUNT(*) FILTER (WHERE status IN ('PENDING', 'ORDERED') AND "unitCostAtRaise" IS NULL))::int      AS "unpricedOrders",
        (COALESCE(SUM(quantity * "receivedUnitCost") FILTER (WHERE status = 'RECEIVED' AND "receivedUnitCost" IS NOT NULL), 0))::numeric(14, 2)::text AS "spent",
        (COUNT(*) FILTER (WHERE status = 'RECEIVED'))::int                                                 AS "receivedOrders",
        (COUNT(*) FILTER (WHERE status = 'RECEIVED' AND "receivedUnitCost" IS NULL))::int                  AS "unrecordedReceived",
        (COALESCE(SUM(quantity * ("receivedUnitCost" - "unitCostAtRaise")) FILTER (WHERE status = 'RECEIVED' AND "receivedUnitCost" IS NOT NULL AND "unitCostAtRaise" IS NOT NULL), 0))::numeric(14, 2)::text AS "variance",
        (COUNT(*) FILTER (WHERE status = 'RECEIVED' AND "receivedUnitCost" IS NOT NULL AND "unitCostAtRaise" IS NOT NULL))::int AS "comparableOrders"
      FROM reorders
    `;

    return row;
  },
};
