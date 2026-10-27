import { z } from "zod";

import { AssetCategoryEnum, AssetStatusEnum } from "../assets/assets.schemas";

export const ASSET_REPORT_SORT_FIELDS = [
  "totalTasks",
  "openTasks",
  "overdueTasks",
  "completedTasks",
  "partsConsumed",
  "avgCompletionDays",
  "name",
] as const;

export const AssetReportQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    search: z.string().optional().openapi({ example: "pump" }),
    category: AssetCategoryEnum.optional(),
    status: AssetStatusEnum.optional(),
    sortBy: z.enum(ASSET_REPORT_SORT_FIELDS).default("totalTasks"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .openapi("AssetReportQuery");

export const TECHNICIAN_WORKLOAD_SORT_FIELDS = [
  "openTasks",
  "inProgressTasks",
  "overdueTasks",
  "completedTasks",
  "nextDueAt",
  "userName",
] as const;

export const TechnicianWorkloadQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    search: z.string().optional().openapi({ example: "sarah" }),
    sortBy: z.enum(TECHNICIAN_WORKLOAD_SORT_FIELDS).default("openTasks"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .openapi("TechnicianWorkloadQuery");

export const THROUGHPUT_GRANULARITIES = ["day", "week", "month"] as const;

export const ThroughputQuerySchema = z
  .object({
    from: z.coerce.date().optional().openapi({ example: "2026-06-01T00:00:00.000Z" }),
    to: z.coerce.date().optional().openapi({ example: "2026-08-29T00:00:00.000Z" }),
    groupBy: z.enum(THROUGHPUT_GRANULARITIES).default("week"),
  })
  .openapi("ThroughputQuery");

export const SpendQuerySchema = z
  .object({
    from: z.coerce.date().optional().openapi({ example: "2026-01-01T00:00:00.000Z" }),
    to: z.coerce.date().optional().openapi({ example: "2026-06-30T23:59:59.000Z" }),
    groupBy: z.enum(THROUGHPUT_GRANULARITIES).default("month"),
  })
  .openapi("SpendQuery");

// — Response schemas — documentation only ——————————————————————————————————

export const AssetReliabilityRowSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    serialNumber: z.string(),
    category: z.string(),
    status: z.string(),
    totalTasks: z.number().int(),
    openTasks: z.number().int(),
    overdueTasks: z.number().int(),
    completedTasks: z.number().int(),
    partsConsumed: z.number().int(),
    avgCompletionDays: z.number().nullable(),
  })
  .openapi("AssetReliabilityRow");

export const AssetReliabilityResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(AssetReliabilityRowSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })
  .openapi("AssetReliabilityResponse");

export const TechnicianWorkloadRowSchema = z
  .object({
    id: z.uuid(),
    userName: z.string(),
    email: z.email(),
    openTasks: z.number().int(),
    inProgressTasks: z.number().int(),
    overdueTasks: z.number().int(),
    completedTasks: z.number().int(),
    nextDueAt: z.iso.datetime().nullable(),
  })
  .openapi("TechnicianWorkloadRow");

export const TechnicianWorkloadResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(TechnicianWorkloadRowSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })
  .openapi("TechnicianWorkloadResponse");

export const ThroughputBucketSchema = z
  .object({
    bucket: z.iso.datetime(),
    created: z.number().int(),
    completed: z.number().int(),
  })
  .openapi("ThroughputBucket");

export const ThroughputResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      from: z.iso.datetime(),
      to: z.iso.datetime(),
      groupBy: z.enum(THROUGHPUT_GRANULARITIES),
      summary: z.object({
        totalCreated: z.number().int(),
        totalCompleted: z.number().int(),
        completionRate: z.number().nullable(),
        avgCompletionDays: z.number().nullable(),
      }),
      series: z.array(ThroughputBucketSchema),
    }),
  })
  .openapi("ThroughputResponse");

const SpendFiguresSchema = z.object({
  spent: z.string().openapi({ example: "9800.00" }),
  // Received orders in the group, including ones with no recorded price.
  receivedOrders: z.number().int().openapi({ example: 40 }),
});

export const SpendResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      from: z.iso.datetime(),
      to: z.iso.datetime(),
      groupBy: z.enum(THROUGHPUT_GRANULARITIES),
      summary: SpendFiguresSchema.extend({
        // Received orders with no actual price recorded: counted, but not in spent.
        unrecordedReceived: z.number().int().openapi({ example: 5 }),
        // Actual - estimate over orders that have both (may be negative).
        variance: z.string().openapi({ example: "120.00" }),
        comparableOrders: z.number().int().openapi({ example: 31 }),
      }),
      series: z.array(SpendFiguresSchema.extend({ bucket: z.iso.datetime() })),
      bySupplier: z.array(
        SpendFiguresSchema.extend({
          supplier: z.string().nullable().openapi({ description: "null = no supplier set" }),
        }),
      ),
      byCategory: z.array(SpendFiguresSchema.extend({ category: z.string() })),
    }),
  })
  .openapi("SpendResponse");

export type AssetReportSortField = (typeof ASSET_REPORT_SORT_FIELDS)[number];
export type AssetReportQuery = z.infer<typeof AssetReportQuerySchema>;
export type TechnicianWorkloadSortField = (typeof TECHNICIAN_WORKLOAD_SORT_FIELDS)[number];
export type TechnicianWorkloadQuery = z.infer<typeof TechnicianWorkloadQuerySchema>;
export type ThroughputGranularity = (typeof THROUGHPUT_GRANULARITIES)[number];
export type ThroughputQuery = z.infer<typeof ThroughputQuerySchema>;
export type SpendQuery = z.infer<typeof SpendQuerySchema>;
