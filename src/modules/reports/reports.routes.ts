import { Router } from "express";

import { Role } from "../../generated/prisma/client";
import { asyncHandler, authenticate, authorize, validateQuery } from "../../middleware";
import { reportsController } from "./reports.controller";
import { AssetReportQuerySchema, ThroughputQuerySchema } from "./reports.schemas";

const router = Router();

// Reports are management-oriented — restricted to ADMIN and MANAGER.
const managers = authorize([Role.ADMIN, Role.MANAGER]);

/**
 * GET /api/v1/reports/assets
 * ADMIN + MANAGER — lifetime reliability per asset (task counts, overdue,
 * parts consumed, average completion time). Paginated, searchable, filterable
 * by category/status, and sortable by any computed metric.
 */
router.get(
  "/assets",
  authenticate,
  managers,
  validateQuery(AssetReportQuerySchema),
  asyncHandler(reportsController.getAssetReliability),
);

/**
 * GET /api/v1/reports/throughput
 * ADMIN + MANAGER — tasks created vs completed over time, bucketed by
 * day/week/month, with a summary (completion rate, average cycle time).
 */
router.get(
  "/throughput",
  authenticate,
  managers,
  validateQuery(ThroughputQuerySchema),
  asyncHandler(reportsController.getThroughput),
);

export default router;
