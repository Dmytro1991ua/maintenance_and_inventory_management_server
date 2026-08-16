import { z } from "zod";

import { INVENTORY_CATEGORIES } from "../inventory/inventory.constants";

export const ChecklistCategoryParamSchema = z.object({
  category: z.enum(INVENTORY_CATEGORIES, { error: "Invalid category" }),
});

export const UpdateChecklistTemplateSchema = z
  .object({
    items: z
      .array(z.string().min(1, { error: "Item cannot be empty" }).max(200))
      .min(1, { error: "At least one checklist item is required" })
      .openapi({ example: ["Filter replaced?", "Unit tested?", "Area cleaned?"] }),
  })
  .strict()
  .openapi("UpdateChecklistTemplateInput");

// — Response schemas — documentation only ——————————————————————————————————

export const ChecklistTemplateSchema = z
  .object({
    id: z.uuid(),
    category: z.enum(INVENTORY_CATEGORIES),
    items: z.array(z.string()),
    updatedAt: z.iso.datetime(),
  })
  .openapi("ChecklistTemplate");

export const ChecklistTemplateResponseSchema = z
  .object({
    success: z.literal(true),
    data: ChecklistTemplateSchema,
  })
  .openapi("ChecklistTemplateResponse");

export const ChecklistTemplatesListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ChecklistTemplateSchema),
  })
  .openapi("ChecklistTemplatesListResponse");

export type ChecklistCategoryParam = z.infer<typeof ChecklistCategoryParamSchema>;
export type UpdateChecklistTemplate = z.infer<typeof UpdateChecklistTemplateSchema>;
