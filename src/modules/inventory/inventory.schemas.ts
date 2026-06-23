import { z } from "zod";

export const InventoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    sortBy: z.enum(["name", "quantity", "createdAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().optional().openapi({ example: "drill" }),
    // z.coerce.boolean() would parse the literal string "false" as true —
    // any non-empty string is truthy in JS. z.stringbool() handles "true"/
    // "false" query-string values correctly.
    lowStock: z.stringbool().optional().openapi({ example: true }),
  })
  .openapi("InventoryQuery");

export const CreateInventoryItemSchema = z
  .object({
    name: z
      .string()
      .min(1, { error: "Name is required" })
      .max(100)
      .openapi({ example: "Cordless Drill" }),
    serialNumber: z
      .string()
      .min(1, { error: "Serial number is required" })
      .max(100)
      .openapi({ example: "SN-00123" }),
    quantity: z.coerce
      .number()
      .int()
      .min(0, { error: "Quantity cannot be negative" })
      .openapi({ example: 12 }),
    minStockLevel: z.coerce
      .number()
      .int()
      .min(0, { error: "Min stock level cannot be negative" })
      .openapi({ example: 5 }),
  })
  .openapi("CreateInventoryItemInput");

export const UpdateInventoryItemSchema = z
  .object({
    name: z
      .string()
      .min(1, { error: "Name is required" })
      .max(100)
      .optional()
      .openapi({ example: "Cordless Drill (18V)" }),
    quantity: z.coerce
      .number()
      .int()
      .min(0, { error: "Quantity cannot be negative" })
      .optional()
      .openapi({ example: 8 }),
    minStockLevel: z.coerce
      .number()
      .int()
      .min(0, { error: "Min stock level cannot be negative" })
      .optional()
      .openapi({ example: 5 }),
  })
  .strict()
  .openapi("UpdateInventoryItemInput");

export const InventoryItemIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid inventory item ID" }),
});

// — Response schemas — documentation only ——————————————————————————————————

export const InventoryItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    serialNumber: z.string(),
    quantity: z.number(),
    minStockLevel: z.number(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("InventoryItem");

export const InventoryItemResponseSchema = z
  .object({
    success: z.literal(true),
    data: InventoryItemSchema,
  })
  .openapi("InventoryItemResponse");

export const InventoryListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(InventoryItemSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })
  .openapi("InventoryListResponse");

export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;
export type CreateInventoryItem = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItem = z.infer<typeof UpdateInventoryItemSchema>;
export type InventoryItemIdParam = z.infer<typeof InventoryItemIdParamSchema>;
