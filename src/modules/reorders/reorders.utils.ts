import { Prisma } from "../../generated/prisma/client";

type ReorderConfig = {
  minStockLevel: number;
  reorderQuantity: number | null;
};

/**
 * How many units to order for an item: its configured reorderQuantity, or a
 * fallback top-up of minStockLevel when unset. Floored at 1 so an item with
 * minStockLevel 0 still orders a unit rather than a no-op zero.
 */
export const resolveReorderQuantity = (item: ReorderConfig): number =>
  Math.max(item.reorderQuantity ?? item.minStockLevel, 1);

// True for a Postgres unique-constraint violation surfaced by Prisma (P2002) —
// e.g. losing the race on the partial unique index for one open reorder.
export const isUniqueConstraintError = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

// Formats a reorder's money at the response edge, all as fixed 2-decimal strings
// (or null), all computed with Decimal.js — exact, never via parseFloat:
//   - unitCostAtRaise / lineTotal  → the committed estimate (× quantity)
//   - receivedUnitCost / receivedTotal → the actual paid (× quantity)
//   - variance = receivedTotal − lineTotal → over (+) or under (−) estimate,
//     only when BOTH an estimate and an actual exist.
export const serializeReorder = <
  T extends {
    unitCostAtRaise: Prisma.Decimal | string | null;
    receivedUnitCost: Prisma.Decimal | string | null;
    quantity: number;
  },
>(
  reorder: T,
): Omit<T, "unitCostAtRaise" | "receivedUnitCost"> & {
  unitCostAtRaise: string | null;
  lineTotal: string | null;
  receivedUnitCost: string | null;
  receivedTotal: string | null;
  variance: string | null;
} => {
  const estimate =
    reorder.unitCostAtRaise == null ? null : new Prisma.Decimal(reorder.unitCostAtRaise);
  const actual =
    reorder.receivedUnitCost == null ? null : new Prisma.Decimal(reorder.receivedUnitCost);

  const lineTotal = estimate == null ? null : estimate.mul(reorder.quantity);
  const receivedTotal = actual == null ? null : actual.mul(reorder.quantity);
  const variance = lineTotal == null || receivedTotal == null ? null : receivedTotal.sub(lineTotal);

  return {
    ...reorder,
    unitCostAtRaise: estimate == null ? null : estimate.toFixed(2),
    lineTotal: lineTotal == null ? null : lineTotal.toFixed(2),
    receivedUnitCost: actual == null ? null : actual.toFixed(2),
    receivedTotal: receivedTotal == null ? null : receivedTotal.toFixed(2),
    variance: variance == null ? null : variance.toFixed(2),
  };
};

export const buildReorderRaisedMessage = (
  name: string,
  quantity: number,
  orderQuantity: number,
): string =>
  `Reorder raised for "${name}": stock is ${quantity}. Ordering ${orderQuantity} unit(s).`;
