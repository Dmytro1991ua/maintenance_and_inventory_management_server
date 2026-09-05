import { z } from "zod";

export const THROUGHPUT_GRANULARITIES = ["day", "week", "month"] as const;

export const ThroughputQuerySchema = z
  .object({
    from: z.coerce.date().optional().openapi({ example: "2026-06-01T00:00:00.000Z" }),
    to: z.coerce.date().optional().openapi({ example: "2026-08-29T00:00:00.000Z" }),
    groupBy: z.enum(THROUGHPUT_GRANULARITIES).default("week"),
  })
  .openapi("ThroughputQuery");

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
  })
  .openapi("AssetReliabilityResponse");

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

export type ThroughputGranularity = (typeof THROUGHPUT_GRANULARITIES)[number];
export type ThroughputQuery = z.infer<typeof ThroughputQuerySchema>;
