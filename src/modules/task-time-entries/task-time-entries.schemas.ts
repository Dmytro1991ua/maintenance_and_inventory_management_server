import { z } from "zod";

import { MAX_ENTRY_MINUTES } from "./task-time-entries.constants";

export const TimeEntryTaskParamSchema = z.object({
  id: z.uuid({ error: "Invalid task ID" }),
});

export const TimeEntryParamsSchema = z.object({
  id: z.uuid({ error: "Invalid task ID" }),
  entryId: z.uuid({ error: "Invalid time entry ID" }),
});

export const CreateTimeEntrySchema = z
  .object({
    minutes: z
      .number()
      .int({ error: "Minutes must be a whole number" })
      .min(1, { error: "Minutes must be at least 1" })
      .max(MAX_ENTRY_MINUTES, { error: "A single entry can't exceed 24 hours" })
      .openapi({ example: 90 }),
    // Defaults to today when omitted; can't be in the future.
    workedOn: z.iso.date().optional().openapi({ example: "2026-11-14" }),
    note: z.string().max(500).optional().openapi({ example: "Replaced the drive belt" }),
  })
  .strict()
  .openapi("CreateTimeEntryInput");

export const TimeEntrySchema = z
  .object({
    id: z.uuid(),
    taskId: z.uuid(),
    minutes: z.number().int(),
    workedOn: z.iso.date(),
    note: z.string().nullable(),
    user: z.object({ id: z.uuid(), userName: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
    // ADMIN and MANAGER only: the rate at the time and the cost it gives.
    hourlyRate: z.string().nullable().optional().openapi({ example: "25.00" }),
    cost: z.string().nullable().optional().openapi({ example: "37.50" }),
  })
  .openapi("TimeEntry");

export const TimeEntryResponseSchema = z
  .object({ success: z.literal(true), data: TimeEntrySchema })
  .openapi("TimeEntryResponse");

export const TimeEntriesSummarySchema = z
  .object({
    entries: z.array(TimeEntrySchema),
    totalMinutes: z.number().int(),
    // ADMIN and MANAGER only.
    totalCost: z.string().optional().openapi({ example: "112.50" }),
    // ADMIN and MANAGER only: minutes with no rate set, which the total excludes.
    unratedMinutes: z.number().int().optional(),
  })
  .openapi("TimeEntriesSummary");

export const TimeEntriesListResponseSchema = z
  .object({ success: z.literal(true), data: TimeEntriesSummarySchema })
  .openapi("TimeEntriesListResponse");

export type TimeEntryTaskParam = z.infer<typeof TimeEntryTaskParamSchema>;
export type TimeEntryParams = z.infer<typeof TimeEntryParamsSchema>;
export type CreateTimeEntry = z.infer<typeof CreateTimeEntrySchema>;
