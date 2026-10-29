import { prisma } from "../../config";
import { Prisma } from "../../generated/prisma/client";
import { getSkipValue } from "../../utils";
import type {
  AssetReportQuery,
  AssetReportSortField,
  TechnicianWorkloadQuery,
  TechnicianWorkloadSortField,
  ThroughputGranularity,
} from "./reports.schemas";

// Spend = quantity x receivedUnitCost; unpriced orders are skipped, not counted as 0.
const SPENT = Prisma.sql`COALESCE(SUM(r.quantity * r."receivedUnitCost") FILTER (WHERE r."receivedUnitCost" IS NOT NULL), 0)`;

const receivedBetween = (from: Date, to: Date): Prisma.Sql =>
  Prisma.sql`r.status = 'RECEIVED' AND r."receivedAt" BETWEEN ${from} AND ${to}`;

// Whitelisted date_trunc unit + generate_series step per granularity. Values
// are bound as parameters (not interpolated), so this map is purely a lookup —
// there is no injection surface.
const GRANULARITY: Record<ThroughputGranularity, { unit: string; step: string }> = {
  day: { unit: "day", step: "1 day" },
  week: { unit: "week", step: "1 week" },
  month: { unit: "month", step: "1 month" },
};

// Whitelist mapping a validated sortBy value to the exact SQL sort expression.
// The map is the only source of ORDER BY identifiers — the request value is a
// key lookup, never interpolated — so Prisma.raw here carries no injection risk.
const ASSET_SORT_EXPR: Record<AssetReportSortField, string> = {
  totalTasks: '"totalTasks"',
  openTasks: '"openTasks"',
  overdueTasks: '"overdueTasks"',
  completedTasks: '"completedTasks"',
  partsConsumed: '"partsConsumed"',
  avgCompletionDays: '"avgCompletionDays"',
  name: "a.name",
};

// Builds the raw WHERE clause over asset columns (applied before GROUP BY).
// Returns Prisma.empty when no filters are active.
const buildAssetReportWhere = (query: AssetReportQuery): Prisma.Sql => {
  const conditions: Prisma.Sql[] = [];

  const search = query.search?.trim();

  if (search) {
    const like = `%${search}%`;

    conditions.push(
      Prisma.sql`(a.name ILIKE ${like} OR a."serialNumber" ILIKE ${like} OR a.location ILIKE ${like})`,
    );
  }

  if (query.category) {
    conditions.push(Prisma.sql`a.category = ${query.category}::"AssetCategory"`);
  }

  if (query.status) {
    conditions.push(Prisma.sql`a.status = ${query.status}::"AssetStatus"`);
  }

  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
};

const TECHNICIAN_WORKLOAD_SORT_COLUMNS: Record<TechnicianWorkloadSortField, string> = {
  openTasks: '"openTasks"',
  inProgressTasks: '"inProgressTasks"',
  overdueTasks: '"overdueTasks"',
  completedTasks: '"completedTasks"',
  nextDueAt: '"nextDueAt"',
  userName: 'u."userName"',
};

const buildTechnicianWorkloadWhere = (query: TechnicianWorkloadQuery): Prisma.Sql => {
  // Active technicians only — a deactivated user can't take work, so including
  // them in a "current workload" view would read as spare capacity.
  const conditions: Prisma.Sql[] = [
    Prisma.sql`'TECHNICIAN'::"Role" = ANY(u.roles)`,
    Prisma.sql`u.status = 'ACTIVE'::"UserStatus"`,
  ];

  const search = query.search?.trim();

  if (search) {
    const like = `%${search}%`;
    conditions.push(Prisma.sql`(u."userName" ILIKE ${like} OR u.email ILIKE ${like})`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
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

type SpendFigures = { spent: string; receivedOrders: number };

type SpendSummaryRow = SpendFigures & {
  unrecordedReceived: number;
  variance: string;
  comparableOrders: number;
};

type TechnicianWorkloadRow = {
  id: string;
  userName: string;
  email: string;
  openTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completedTasks: number;
  nextDueAt: Date | null;
};

export const reportsRepository = {
  // Number of assets matching the report filters — for pagination meta. Counts
  // assets (one report row per asset), so it's a plain count over the same
  // WHERE, without the task join or grouping.
  countAssetReliability: async (query: AssetReportQuery): Promise<number> => {
    const where = buildAssetReportWhere(query);

    const rows = await prisma.$queryRaw<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM assets a ${where}
    `;

    return rows[0].count;
  },

  // Lifetime reliability per asset — one row per asset (including those with no
  // tasks). partsConsumed uses a correlated subquery to avoid the row fan-out
  // that a direct join to task_part_usages would cause against the task join.
  // Filtered/sorted/paginated per the query; a unique tiebreaker (a.name, then
  // a.id) keeps offset paging stable when the sort metric has ties, and
  // NULLS LAST keeps assets with no completed work out of the way when sorting
  // by avgCompletionDays.
  getAssetReliability: (query: AssetReportQuery): Promise<AssetReliabilityRow[]> => {
    const where = buildAssetReportWhere(query);
    const skip = getSkipValue(query.page, query.limit);
    const orderExpr = Prisma.raw(ASSET_SORT_EXPR[query.sortBy]);
    const orderDir = Prisma.raw(query.sortOrder === "asc" ? "ASC" : "DESC");

    return prisma.$queryRaw<AssetReliabilityRow[]>`
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
      ${where}
      GROUP BY a.id
      ORDER BY ${orderExpr} ${orderDir} NULLS LAST, a.name ASC, a.id ASC
      LIMIT ${query.limit}
      OFFSET ${skip}
    `;
  },

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

  getSpendSummary: async (from: Date, to: Date): Promise<SpendSummaryRow> => {
    const rows = await prisma.$queryRaw<SpendSummaryRow[]>`
      SELECT
        ROUND(${SPENT}, 2)::text                                                AS spent,
        COUNT(*)::int                                                                  AS "receivedOrders",
        COUNT(*) FILTER (WHERE r."receivedUnitCost" IS NULL)::int                      AS "unrecordedReceived",
        ROUND(COALESCE(SUM(r.quantity * (r."receivedUnitCost" - r."unitCostAtRaise")) FILTER (
          WHERE r."receivedUnitCost" IS NOT NULL AND r."unitCostAtRaise" IS NOT NULL
        ), 0), 2)::text                                                    AS variance,
        COUNT(*) FILTER (
          WHERE r."receivedUnitCost" IS NOT NULL AND r."unitCostAtRaise" IS NOT NULL
        )::int                                                                         AS "comparableOrders"
      FROM reorders r
      WHERE ${receivedBetween(from, to)}
    `;

    return rows[0];
  },

  // Zero-filled, like throughput.
  getSpendSeries: (
    from: Date,
    to: Date,
    groupBy: ThroughputGranularity,
  ): Promise<(SpendFigures & { bucket: Date })[]> => {
    const { unit, step } = GRANULARITY[groupBy];

    return prisma.$queryRaw<(SpendFigures & { bucket: Date })[]>`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc(${unit}, ${from}::timestamptz),
          date_trunc(${unit}, ${to}::timestamptz),
          ${step}::interval
        ) AS bucket
      ),
      received AS (
        SELECT date_trunc(${unit}, r."receivedAt") AS bucket, ${SPENT} AS spent, COUNT(*)::int AS c
        FROM reorders r
        WHERE ${receivedBetween(from, to)}
        GROUP BY 1
      )
      SELECT
        b.bucket                                        AS bucket,
        ROUND(COALESCE(rc.spent, 0), 2)::text     AS spent,
        COALESCE(rc.c, 0)::int                          AS "receivedOrders"
      FROM buckets b
      LEFT JOIN received rc ON rc.bucket = b.bucket
      ORDER BY b.bucket
    `;
  },

  // By supplier frozen at receive; a null supplier is its own group.
  getSpendBySupplier: (
    from: Date,
    to: Date,
  ): Promise<(SpendFigures & { supplier: string | null })[]> =>
    prisma.$queryRaw<(SpendFigures & { supplier: string | null })[]>`
      SELECT
        r."receivedSupplier"      AS supplier,
        ROUND(${SPENT}, 2)::text  AS spent,
        COUNT(*)::int             AS "receivedOrders"
      FROM reorders r
      WHERE ${receivedBetween(from, to)}
      GROUP BY r."receivedSupplier"
      ORDER BY ${SPENT} DESC, r."receivedSupplier" ASC NULLS LAST
    `,

  // By frozen category; the join is only a fallback.
  getSpendByCategory: (from: Date, to: Date): Promise<(SpendFigures & { category: string })[]> =>
    prisma.$queryRaw<(SpendFigures & { category: string })[]>`
      SELECT
        COALESCE(r."receivedCategory", i.category)::text  AS category,
        ROUND(${SPENT}, 2)::text                          AS spent,
        COUNT(*)::int                                     AS "receivedOrders"
      FROM reorders r
      JOIN inventory_items i ON i.id = r."inventoryItemId"
      WHERE ${receivedBetween(from, to)}
      GROUP BY COALESCE(r."receivedCategory", i.category)
      ORDER BY ${SPENT} DESC, COALESCE(r."receivedCategory", i.category) ASC
    `,

  // Number of technicians matching the report filter — for pagination meta.
  countTechnicianWorkload: async (query: TechnicianWorkloadQuery): Promise<number> => {
    const where = buildTechnicianWorkloadWhere(query);

    const rows = await prisma.$queryRaw<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM users u ${where}
    `;

    return rows[0].count;
  },

  // Current workload per technician — one row per technician (including those
  // with no assigned tasks). nextDueAt is the earliest *upcoming* due date among
  // their non-terminal tasks; overdue work is surfaced separately in overdueTasks.
  getTechnicianWorkload: (query: TechnicianWorkloadQuery): Promise<TechnicianWorkloadRow[]> => {
    const where = buildTechnicianWorkloadWhere(query);
    const skip = getSkipValue(query.page, query.limit);
    const orderColumn = Prisma.raw(TECHNICIAN_WORKLOAD_SORT_COLUMNS[query.sortBy]);
    const orderDir = Prisma.raw(query.sortOrder === "asc" ? "ASC" : "DESC");

    return prisma.$queryRaw<TechnicianWorkloadRow[]>`
      SELECT
        u.id,
        u."userName",
        u.email,
        COUNT(t.id) FILTER (WHERE t.status = 'OPEN')::int                                 AS "openTasks",
        COUNT(t.id) FILTER (WHERE t.status = 'IN_PROGRESS')::int                          AS "inProgressTasks",
        COUNT(t.id) FILTER (
          WHERE t."dueDate" < NOW() AND t.status NOT IN ('DONE', 'CANCELLED')
        )::int                                                                            AS "overdueTasks",
        COUNT(t.id) FILTER (WHERE t.status = 'DONE')::int                                 AS "completedTasks",
        MIN(t."dueDate") FILTER (
          WHERE t.status NOT IN ('DONE', 'CANCELLED') AND t."dueDate" >= NOW()
        )                                                                                 AS "nextDueAt"
      FROM users u
      LEFT JOIN tasks t ON t."assignedTo" = u.id
      ${where}
      GROUP BY u.id
      ORDER BY ${orderColumn} ${orderDir} NULLS LAST, u."userName" ASC, u.id ASC
      LIMIT ${query.limit}
      OFFSET ${skip}
    `;
  },
};
