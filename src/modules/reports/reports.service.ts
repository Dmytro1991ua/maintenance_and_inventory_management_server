import { BadRequestError } from "../../errors";
import { getTotalPages } from "../../utils";
import { reportsRepository } from "./reports.repository";
import type { AssetReportQuery, ThroughputGranularity, ThroughputQuery } from "./reports.schemas";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 84; // 12 weeks

const round1 = (n: number | null): number | null => (n == null ? null : Math.round(n * 10) / 10);

export const reportsService = {
  getAssetReliability: async (query: AssetReportQuery) => {
    const [rows, total] = await Promise.all([
      reportsRepository.getAssetReliability(query),
      reportsRepository.countAssetReliability(query),
    ]);

    return {
      data: rows.map((row) => ({ ...row, avgCompletionDays: round1(row.avgCompletionDays) })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        pages: getTotalPages(total, query.limit),
      },
    };
  },

  getThroughput: async (query: ThroughputQuery) => {
    const groupBy: ThroughputGranularity = query.groupBy;

    // Default to the last 12 weeks ending now when no range is given.
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);

    if (from > to) {
      throw new BadRequestError("`from` must be on or before `to`");
    }

    const [series, summary] = await Promise.all([
      reportsRepository.getThroughputSeries(from, to, groupBy),
      reportsRepository.getThroughputSummary(from, to),
    ]);

    const completionRate =
      summary.totalCreated > 0
        ? Math.round((summary.totalCompleted / summary.totalCreated) * 1000) / 1000
        : null;

    return {
      from,
      to,
      groupBy,
      summary: {
        totalCreated: summary.totalCreated,
        totalCompleted: summary.totalCompleted,
        completionRate,
        avgCompletionDays: round1(summary.avgCompletionDays),
      },
      series,
    };
  },
};
