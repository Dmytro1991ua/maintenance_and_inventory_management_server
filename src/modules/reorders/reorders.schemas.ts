import { z } from "zod";

import { MoneyInput } from "../../shared/money.schema";
import { REORDER_STATUSES } from "./reorders.constants";

export { REORDER_STATUSES };

export const ReorderStatusEnum = z.enum(REORDER_STATUSES);

export const ReordersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    status: ReorderStatusEnum.optional(),
    inventoryItemId: z.uuid().optional(),
    sortBy: z.enum(["createdAt", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .openapi("ReordersQuery");

export const CreateReorderSchema = z
  .object({
    inventoryItemId: z.uuid({ error: "Invalid inventory item ID" }),
  })
  .strict()
  .openapi("CreateReorderInput");

export const ReorderIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid reorder ID" }),
});

export const ReceiveReorderSchema = z
  .object({
    receivedUnitCost: MoneyInput.optional().openapi({ example: "9.00" }),
  })
  .strict()
  .openapi("ReceiveReorderInput");

// — Response schemas — documentation only ——————————————————————————————————

export const ReorderSchema = z
  .object({
    id: z.uuid(),
    inventoryItemId: z.uuid(),
    status: ReorderStatusEnum,
    quantity: z.number().int(),
    // Committed estimate: cost captured at raise time (frozen) and quantity × it.
    // Both null when the item was unpriced when the reorder was raised.
    unitCostAtRaise: z.string().nullable().openapi({ example: "8.50" }),
    lineTotal: z.string().nullable().openapi({ example: "510.00" }),
    receivedUnitCost: z.string().nullable().openapi({ example: "9.00" }),
    receivedTotal: z.string().nullable().openapi({ example: "540.00" }),
    variance: z.string().nullable().openapi({ example: "30.00" }),
    receivedAt: z.iso.datetime().nullable(),
    raisedBy: z.uuid().nullable(),
    reviewedBy: z.uuid().nullable(),
    inventoryItem: z.object({
      id: z.uuid(),
      name: z.string(),
      serialNumber: z.string(),
      quantity: z.number().int(),
      minStockLevel: z.number().int(),
      reorderPoint: z.number().int().nullable(),
      supplier: z.string().nullable(),
    }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Reorder");

export const ReorderResponseSchema = z
  .object({
    success: z.literal(true),
    data: ReorderSchema,
  })
  .openapi("ReorderResponse");

export const ReorderStatsResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      // Committed — OPEN orders (PENDING + ORDERED).
      committedSpend: z.string().openapi({ example: "4210.00" }),
      openOrders: z.number().int().openapi({ example: 12 }),
      // Open orders with no captured cost — excluded from committedSpend.
      unpricedOrders: z.number().int().openapi({ example: 3 }),
      // Spent — RECEIVED orders, by actual price paid.
      spent: z.string().openapi({ example: "9800.00" }),
      receivedOrders: z.number().int().openapi({ example: 40 }),
      // Received orders with no actual cost recorded — excluded from spent.
      unrecordedReceived: z.number().int().openapi({ example: 5 }),
      // Overall variance (actual − estimate; may be negative) over received orders
      // that have BOTH an actual and an estimate, plus how many that covers.
      variance: z.string().openapi({ example: "120.00" }),
      comparableOrders: z.number().int().openapi({ example: 31 }),
    }),
  })
  .openapi("ReorderStatsResponse");

export const ReordersListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ReorderSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })
  .openapi("ReordersListResponse");

export type ReordersQuery = z.infer<typeof ReordersQuerySchema>;
export type CreateReorder = z.infer<typeof CreateReorderSchema>;
export type ReceiveReorder = z.infer<typeof ReceiveReorderSchema>;
export type ReorderIdParam = z.infer<typeof ReorderIdParamSchema>;
