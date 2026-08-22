import { z } from "zod";

import { INVENTORY_CATEGORIES } from "../inventory/inventory.constants";

const RecurringTaskCategoryEnum = z.enum(INVENTORY_CATEGORIES);

export const RecurringTasksQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    isActive: z.stringbool().optional().openapi({ example: true }),
  })
  .openapi("RecurringTasksQuery");

export const CreateRecurringTaskSchema = z
  .object({
    title: z
      .string()
      .min(1, { error: "Title is required" })
      .max(200)
      .openapi({ example: "Replace HVAC filter — Building A" }),
    description: z
      .string()
      .max(2000)
      .optional()
      .openapi({ example: "Replace the return-air filter with a MERV-13 unit." }),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM").openapi({ example: "MEDIUM" }),
    category: RecurringTaskCategoryEnum.optional().openapi({ example: "HVAC" }),
    assignedTo: z
      .uuid({ error: "Invalid user ID" })
      .optional()
      .openapi({ example: "f47ac10b-58cc-4372-a567-0e02b2c3d479" }),
    intervalDays: z
      .number()
      .int()
      .min(1, { error: "Interval must be at least 1 day" })
      .max(365, { error: "Interval cannot exceed 365 days" })
      .openapi({ example: 90 }),
    firstDueAt: z.coerce.date().openapi({ example: "2026-09-01T00:00:00.000Z" }),
  })
  .strict()
  .openapi("CreateRecurringTaskInput");

export const UpdateRecurringTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().openapi({ example: "HIGH" }),
    category: RecurringTaskCategoryEnum.nullable().optional(),
    assignedTo: z.uuid({ error: "Invalid user ID" }).nullable().optional(),
    intervalDays: z.number().int().min(1).max(365).optional().openapi({ example: 30 }),
  })
  .strict()
  .openapi("UpdateRecurringTaskInput");

export const RecurringTaskIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid recurring task ID" }),
});

// — Response schemas — documentation only ——————————————————————————————————

export const RecurringTaskSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
    category: RecurringTaskCategoryEnum.nullable(),
    assignedTo: z.uuid().nullable(),
    assignee: z
      .object({
        id: z.uuid(),
        userName: z.string(),
        email: z.string(),
      })
      .nullable(),
    intervalDays: z.number().int(),
    nextDueAt: z.iso.datetime(),
    isActive: z.boolean(),
    createdBy: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("RecurringTask");

export const RecurringTaskResponseSchema = z
  .object({
    success: z.literal(true),
    data: RecurringTaskSchema,
  })
  .openapi("RecurringTaskResponse");

export const RecurringTasksListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(RecurringTaskSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })
  .openapi("RecurringTasksListResponse");

export type RecurringTasksQuery = z.infer<typeof RecurringTasksQuerySchema>;
export type CreateRecurringTask = z.infer<typeof CreateRecurringTaskSchema>;
export type UpdateRecurringTask = z.infer<typeof UpdateRecurringTaskSchema>;
export type RecurringTaskIdParam = z.infer<typeof RecurringTaskIdParamSchema>;
