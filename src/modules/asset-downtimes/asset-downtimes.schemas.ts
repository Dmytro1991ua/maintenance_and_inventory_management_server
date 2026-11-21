import { z } from "zod";

import { endOfDayIfDateOnly } from "../../utils";

const DowntimeReasonEnum = z.enum(["BREAKDOWN", "PLANNED"]);

export const DowntimeAssetParamSchema = z.object({
  id: z.uuid({ error: "Invalid asset ID" }),
});

export const DowntimeParamsSchema = z.object({
  id: z.uuid({ error: "Invalid asset ID" }),
  downtimeId: z.uuid({ error: "Invalid downtime ID" }),
});

export const DowntimeQuerySchema = z
  .object({
    from: z.coerce.date().optional().openapi({ example: "2026-01-01T00:00:00.000Z" }),
    // A plain date includes that whole day.
    to: z.preprocess(
      endOfDayIfDateOnly,
      z.coerce.date().optional().openapi({ example: "2026-06-30" }),
    ),
  })
  .openapi("DowntimeQuery");

export const StartDowntimeSchema = z
  .object({
    reason: DowntimeReasonEnum.default("BREAKDOWN"),
    // Defaults to now; use it to backdate a breakdown found late.
    startedAt: z.iso.datetime().optional().openapi({ example: "2026-11-19T08:30:00.000Z" }),
    note: z.string().max(500).optional().openapi({ example: "Compressor tripped" }),
    taskId: z.uuid().optional(),
  })
  .strict()
  .openapi("StartDowntimeInput");

export const EndDowntimeSchema = z
  .object({
    // Defaults to now.
    endedAt: z.iso.datetime().optional().openapi({ example: "2026-11-19T14:00:00.000Z" }),
  })
  .strict()
  .openapi("EndDowntimeInput");

export const DowntimeEventSchema = z
  .object({
    id: z.uuid(),
    assetId: z.uuid(),
    taskId: z.uuid().nullable(),
    reason: DowntimeReasonEnum,
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().nullable().openapi({ description: "null = still down" }),
    note: z.string().nullable(),
    // An ongoing event counts up to now.
    durationMinutes: z.number().int(),
    creator: z.object({ id: z.uuid(), userName: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
  })
  .openapi("DowntimeEvent");

export const DowntimeEventResponseSchema = z
  .object({ success: z.literal(true), data: DowntimeEventSchema })
  .openapi("DowntimeEventResponse");

const DowntimeSummarySchema = z.object({
  windowMinutes: z.number().int(),
  downtimeMinutes: z.number().int(),
  breakdownMinutes: z.number().int(),
  plannedMinutes: z.number().int(),
  breakdowns: z.number().int(),
  availabilityPercent: z.number().nullable().openapi({ example: 98.7 }),
  mttrMinutes: z.number().int().nullable().openapi({ description: "Mean time to repair" }),
  mtbfMinutes: z.number().int().nullable().openapi({ description: "Mean time between breakdowns" }),
});

export const DowntimeListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      from: z.iso.datetime(),
      to: z.iso.datetime(),
      summary: DowntimeSummarySchema,
      events: z.array(DowntimeEventSchema),
    }),
  })
  .openapi("DowntimeListResponse");

export type DowntimeAssetParam = z.infer<typeof DowntimeAssetParamSchema>;
export type DowntimeParams = z.infer<typeof DowntimeParamsSchema>;
export type DowntimeQuery = z.infer<typeof DowntimeQuerySchema>;
export type StartDowntime = z.infer<typeof StartDowntimeSchema>;
export type EndDowntime = z.infer<typeof EndDowntimeSchema>;
