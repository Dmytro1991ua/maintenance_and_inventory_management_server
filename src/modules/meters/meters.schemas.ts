import { z } from "zod";

import { MAX_METER_READING } from "./meters.constants";

// Deliberately not z.coerce: coercion turns null/"" into 0, which would silently
// record a bogus zero reading instead of rejecting a malformed request.
const ReadingValue = z
  .number()
  .int()
  .min(0, { error: "Reading cannot be negative" })
  .max(MAX_METER_READING, { error: "Reading is too large" });

export const MetersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    assetId: z.uuid().optional(),
    sortBy: z.enum(["name", "lastReadingAt", "createdAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .openapi("MetersQuery");

export const ReadingsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
  })
  .openapi("MeterReadingsQuery");

export const CreateMeterSchema = z
  .object({
    assetId: z.uuid({ error: "Invalid asset ID" }),
    name: z
      .string()
      .trim()
      .min(1, { error: "Name is required" })
      .max(100)
      .openapi({ example: "Engine hours" }),
    unit: z
      .string()
      .trim()
      .min(1, { error: "Unit is required" })
      .max(30)
      .openapi({ example: "hours" }),
    // Logged as the first reading, so the meter's current reading always matches its log.
    initialReading: ReadingValue.default(0).openapi({ example: 1240 }),
  })
  .strict()
  .openapi("CreateMeterInput");

// Only the name is editable: the unit is fixed once readings exist.
export const UpdateMeterSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Name is required" })
      .max(100)
      .openapi({ example: "Engine hours (main)" }),
  })
  .strict()
  .openapi("UpdateMeterInput");

// Strict, so a client trying to send recordedAt gets a 400 — readings are
// always stamped by the server.
export const RecordReadingSchema = z
  .object({ value: ReadingValue.openapi({ example: 1255 }) })
  .strict()
  .openapi("RecordReadingInput");

export const MeterIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid meter ID" }),
});

// — Response schemas — documentation only ——————————————————————————————————

export const MeterSchema = z
  .object({
    id: z.uuid(),
    assetId: z.uuid(),
    name: z.string(),
    unit: z.string(),
    currentReading: z.number().int(),
    lastReadingAt: z.iso.datetime(),
    asset: z.object({ id: z.uuid(), name: z.string(), serialNumber: z.string() }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Meter");

export const MeterReadingSchema = z
  .object({
    id: z.uuid(),
    meterId: z.uuid(),
    value: z.number().int(),
    recordedAt: z.iso.datetime(),
    recorder: z.object({ id: z.uuid(), userName: z.string() }).nullable(),
  })
  .openapi("MeterReading");

const PaginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  pages: z.number(),
});

export const MeterResponseSchema = z
  .object({ success: z.literal(true), data: MeterSchema })
  .openapi("MeterResponse");

export const MetersListResponseSchema = z
  .object({ success: z.literal(true), data: z.array(MeterSchema), meta: PaginationMetaSchema })
  .openapi("MetersListResponse");

export const RecordReadingResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({ reading: MeterReadingSchema, meter: MeterSchema }),
  })
  .openapi("RecordReadingResponse");

export const ReadingsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(MeterReadingSchema),
    meta: PaginationMetaSchema,
  })
  .openapi("MeterReadingsListResponse");

export type MetersQuery = z.infer<typeof MetersQuerySchema>;
export type ReadingsQuery = z.infer<typeof ReadingsQuerySchema>;
export type CreateMeter = z.infer<typeof CreateMeterSchema>;
export type UpdateMeter = z.infer<typeof UpdateMeterSchema>;
export type RecordReading = z.infer<typeof RecordReadingSchema>;
export type MeterIdParam = z.infer<typeof MeterIdParamSchema>;
