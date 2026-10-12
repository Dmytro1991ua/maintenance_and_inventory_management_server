import { z } from "zod";

import { INVENTORY_CATEGORIES } from "../inventory/inventory.constants";
import { MAX_METER_READING } from "../meters/meters.constants";

const RecurringTaskCategoryEnum = z.enum(INVENTORY_CATEGORIES);

export const RecurringTasksQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    isActive: z.stringbool().optional().openapi({ example: true }),
  })
  .openapi("RecurringTasksQuery");

// Fields every schedule has, whatever triggers it.
const scheduleFields = {
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
};

// A body with no `meterId` is a time-based schedule, as it always was.
export const CreateTimeRecurringTaskSchema = z
  .object({
    ...scheduleFields,
    intervalDays: z
      .number()
      .int()
      .min(1, { error: "Interval must be at least 1 day" })
      .max(365, { error: "Interval cannot exceed 365 days" })
      .openapi({ example: 90 }),
    firstDueAt: z.coerce.date().openapi({ example: "2026-09-01T00:00:00.000Z" }),
    assetId: z.uuid({ error: "Invalid asset ID" }).optional(),
  })
  .strict()
  .openapi("CreateTimeRecurringTaskInput");

// A body with a `meterId` is a meter-triggered one. The asset is taken from the
// meter and can't be sent, so the two can never disagree.
export const CreateMeterRecurringTaskSchema = z
  .object({
    ...scheduleFields,
    meterId: z.uuid({ error: "Invalid meter ID" }),
    intervalReading: z
      .number()
      .int()
      .min(1, { error: "Interval must be at least 1" })
      .max(MAX_METER_READING)
      .openapi({ example: 250 }),
    // The first threshold; defaults to the meter's current reading plus the interval.
    firstDueReading: z.number().int().min(0).max(MAX_METER_READING).optional().openapi({
      example: 1250,
    }),
  })
  .strict()
  .openapi("CreateMeterRecurringTaskInput");

// Documentation only: the route validates with whichever branch above matches the
// body. A runtime union would collapse field-level errors into one form-level one.
export const CreateRecurringTaskSchema = z
  .union([CreateTimeRecurringTaskSchema, CreateMeterRecurringTaskSchema])
  .openapi("CreateRecurringTaskInput");

export const UpdateRecurringTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional().openapi({ example: "HIGH" }),
    category: RecurringTaskCategoryEnum.nullable().optional(),
    assignedTo: z.uuid({ error: "Invalid user ID" }).nullable().optional(),
    // Time-based schedules only; a meter schedule's interval is fixed.
    intervalDays: z.number().int().min(1).max(365).optional().openapi({ example: 30 }),
    // Time-based schedules only; a meter schedule takes its asset from the meter.
    assetId: z.uuid({ error: "Invalid asset ID" }).nullable().optional(),
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
        email: z.email(),
      })
      .nullable(),
    assetId: z.uuid().nullable(),
    asset: z.object({ id: z.uuid(), name: z.string(), serialNumber: z.string() }).nullable(),
    triggerType: z.enum(["TIME", "METER"]),
    // Time-based schedules only; null on a meter schedule.
    intervalDays: z.number().int().nullable(),
    nextDueAt: z.iso.datetime().nullable(),
    // Meter schedules only; null on a time-based one.
    meterId: z.uuid().nullable(),
    meter: z
      .object({
        id: z.uuid(),
        name: z.string(),
        unit: z.string(),
        currentReading: z.number().int(),
      })
      .nullable(),
    intervalReading: z.number().int().nullable(),
    firstDueReading: z.number().int().nullable(),
    nextDueReading: z.number().int().nullable(),
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
export type CreateTimeRecurringTask = z.infer<typeof CreateTimeRecurringTaskSchema>;
export type CreateMeterRecurringTask = z.infer<typeof CreateMeterRecurringTaskSchema>;
export type CreateRecurringTask = CreateTimeRecurringTask | CreateMeterRecurringTask;
export type UpdateRecurringTask = z.infer<typeof UpdateRecurringTaskSchema>;
export type RecurringTaskIdParam = z.infer<typeof RecurringTaskIdParamSchema>;

export const isMeterSchedule = (data: CreateRecurringTask): data is CreateMeterRecurringTask =>
  "meterId" in data;
