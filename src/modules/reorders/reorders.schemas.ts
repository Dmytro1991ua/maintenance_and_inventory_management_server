import { z } from "zod";

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

// — Response schemas — documentation only ——————————————————————————————————

export const ReorderSchema = z
  .object({
    id: z.uuid(),
    inventoryItemId: z.uuid(),
    status: ReorderStatusEnum,
    quantity: z.number().int(),
    raisedBy: z.uuid().nullable(),
    reviewedBy: z.uuid().nullable(),
    inventoryItem: z.object({
      id: z.uuid(),
      name: z.string(),
      serialNumber: z.string(),
      quantity: z.number().int(),
      minStockLevel: z.number().int(),
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
export type ReorderIdParam = z.infer<typeof ReorderIdParamSchema>;
