import { prisma } from "../../config";
import type { ThroughputGranularity } from "./reports.schemas";

// Whitelisted date_trunc unit + generate_series step per granularity. Values
// are bound as parameters (not interpolated), so this map is purely a lookup —
// there is no injection surface.
const GRANULARITY: Record<ThroughputGranularity, { unit: string; step: string }> = {
  day: { unit: "day", step: "1 day" },
  week: { unit: "week", step: "1 week" },
  month: { unit: "month", step: "1 month" },
};

type AssetReliabilityRow = {
  id: string;
  name: string;
  serialNumber: string;
  category: string;
  status: string;
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
  partsConsumed: number;
  avgCompletionDays: number | null;
};

type ThroughputBucketRow = { bucket: Date; created: number; completed: number };

type ThroughputSummaryRow = {
  totalCreated: number;
  totalCompleted: number;
  avgCompletionDays: number | null;
};

export const reportsRepository = {
  // Lifetime reliability per asset — one row per asset (including those with no
  // tasks). partsConsumed uses a correlated subquery to avoid the row fan-out
  // that a direct join to task_part_usages would cause against the task join.
  getAssetReliability: (): Promise<AssetReliabilityRow[]> =>
    prisma.$queryRaw<AssetReliabilityRow[]>`
      SELECT
        a.id,
        a.name,
        a."serialNumber",
        a.category::text                                                                  AS category,
        a.status::text                                                                    AS status,
        COUNT(t.id)::int                                                                  AS "totalTasks",
        COUNT(t.id) FILTER (WHERE t.status IN ('OPEN', 'IN_PROGRESS'))::int               AS "openTasks",
        COUNT(t.id) FILTER (
          WHERE t."dueDate" < NOW() AND t.status NOT IN ('DONE', 'CANCELLED')
        )::int                                                                            AS "overdueTasks",
        COUNT(t.id) FILTER (WHERE t.status = 'DONE')::int                                 AS "completedTasks",
        COALESCE((
          SELECT SUM(tpu.quantity)
          FROM task_part_usages tpu
          JOIN tasks t2 ON t2.id = tpu."taskId"
          WHERE t2."assetId" = a.id
        ), 0)::int                                                                        AS "partsConsumed",
        AVG(
          EXTRACT(EPOCH FROM (t."completedAt" - t."createdAt")) / 86400.0
        ) FILTER (WHERE t.status = 'DONE' AND t."completedAt" IS NOT NULL)::float         AS "avgCompletionDays"
      FROM assets a
      LEFT JOIN tasks t ON t."assetId" = a.id
      GROUP BY a.id
      ORDER BY "totalTasks" DESC, a.name ASC
    `,

  getThroughputSeries: (
    from: Date,
    to: Date,
    groupBy: ThroughputGranularity,
  ): Promise<ThroughputBucketRow[]> => {
    const { unit, step } = GRANULARITY[groupBy];

    return prisma.$queryRaw<ThroughputBucketRow[]>`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc(${unit}, ${from}::timestamptz),
          date_trunc(${unit}, ${to}::timestamptz),
          ${step}::interval
        ) AS bucket
      ),
      created AS (
        SELECT date_trunc(${unit}, "createdAt") AS bucket, COUNT(*)::int AS c
        FROM tasks
        WHERE "createdAt" BETWEEN ${from} AND ${to}
        GROUP BY 1
      ),
      completed AS (
        SELECT date_trunc(${unit}, "completedAt") AS bucket, COUNT(*)::int AS c
        FROM tasks
        WHERE status = 'DONE' AND "completedAt" BETWEEN ${from} AND ${to}
        GROUP BY 1
      )
      SELECT
        b.bucket                        AS bucket,
        COALESCE(cr.c, 0)::int          AS created,
        COALESCE(cp.c, 0)::int          AS completed
      FROM buckets b
      LEFT JOIN created cr ON cr.bucket = b.bucket
      LEFT JOIN completed cp ON cp.bucket = b.bucket
      ORDER BY b.bucket
    `;
  },

  getThroughputSummary: async (from: Date, to: Date): Promise<ThroughputSummaryRow> => {
    const rows = await prisma.$queryRaw<ThroughputSummaryRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE "createdAt" BETWEEN ${from} AND ${to})::int          AS "totalCreated",
        COUNT(*) FILTER (
          WHERE status = 'DONE' AND "completedAt" BETWEEN ${from} AND ${to}
        )::int                                                                       AS "totalCompleted",
        AVG(
          EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400.0
        ) FILTER (WHERE status = 'DONE' AND "completedAt" BETWEEN ${from} AND ${to})::float
                                                                                     AS "avgCompletionDays"
      FROM tasks
    `;

    return rows[0];
  },
};
