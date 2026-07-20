import { z } from "zod";

import { INVENTORY_CATEGORIES, INVENTORY_STATUSES } from "./inventory.constants";

export { INVENTORY_CATEGORIES };

export const InventoryCategoryEnum = z.enum(INVENTORY_CATEGORIES);
export const InventoryStatusEnum = z.enum(INVENTORY_STATUSES);

export const InventoryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    sortBy: z.enum(["name", "quantity", "category", "createdAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().optional().openapi({ example: "drill" }),
    category: InventoryCategoryEnum.optional(),
    status: InventoryStatusEnum.optional(),
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
    category: InventoryCategoryEnum,
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
    category: InventoryCategoryEnum.optional(),
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

export const RestockInventoryItemSchema = z
  .object({
    quantityToAdd: z.coerce
      .number()
      .int()
      .min(1, { error: "Quantity to add must be at least 1" })
      .openapi({ example: 50 }),
  })
  .openapi("RestockInventoryItemInput");

// — Response schemas — documentation only ——————————————————————————————————

export const InventoryItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    serialNumber: z.string(),
    category: InventoryCategoryEnum,
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

export const InventoryCategoriesResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(InventoryCategoryEnum),
  })
  .openapi("InventoryCategoriesResponse");

const CategoryStatsSchema = z.object({
  total: z.number().int(),
  inStock: z.number().int(),
  lowStock: z.number().int(),
  outOfStock: z.number().int(),
});

export const InventoryStatsResponseSchema = z
  .object({
    success: z.literal(true),
    data: CategoryStatsSchema.extend({
      byCategory: z.record(InventoryCategoryEnum, CategoryStatsSchema),
    }),
  })
  .openapi("InventoryStatsResponse");

export type InventoryCategory = z.infer<typeof InventoryCategoryEnum>;
export type InventoryStatus = z.infer<typeof InventoryStatusEnum>;
export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;
export type CreateInventoryItem = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItem = z.infer<typeof UpdateInventoryItemSchema>;
export type RestockInventoryItem = z.infer<typeof RestockInventoryItemSchema>;
export type InventoryItemIdParam = z.infer<typeof InventoryItemIdParamSchema>;
