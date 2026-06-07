import { z } from "zod";

export const InventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "quantity", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  lowStock: z.coerce.boolean().optional(),
});

export const CreateInventoryItemSchema = z.object({
  name: z.string().min(1, { error: "Name is required" }).max(100),
  serialNumber: z.string().min(1, { error: "Serial number is required" }).max(100),
  quantity: z.coerce.number().int().min(0, { error: "Quantity cannot be negative" }),
  minStockLevel: z.coerce.number().int().min(0, { error: "Min stock level cannot be negative" }),
});

export const UpdateInventoryItemSchema = z
  .object({
    name: z.string().min(1, { error: "Name is required" }).max(100).optional(),
    quantity: z.coerce.number().int().min(0, { error: "Quantity cannot be negative" }).optional(),
    minStockLevel: z.coerce
      .number()
      .int()
      .min(0, { error: "Min stock level cannot be negative" })
      .optional(),
  })
  .strict();

export const InventoryItemIdParamSchema = z.object({
  id: z.string().uuid({ error: "Invalid inventory item ID" }),
});

export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;
export type CreateInventoryItem = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItem = z.infer<typeof UpdateInventoryItemSchema>;
export type InventoryItemIdParam = z.infer<typeof InventoryItemIdParamSchema>;
