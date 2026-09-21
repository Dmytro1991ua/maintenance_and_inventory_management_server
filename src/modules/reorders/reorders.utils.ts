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

export const buildReorderRaisedMessage = (
  name: string,
  quantity: number,
  orderQuantity: number,
): string =>
  `Reorder raised for "${name}": stock is ${quantity}. Ordering ${orderQuantity} unit(s).`;
