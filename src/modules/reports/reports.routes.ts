import { Router } from "express";

import { Role } from "../../generated/prisma/client";
import { asyncHandler, authenticate, authorize, validateQuery } from "../../middleware";
import { reportsController } from "./reports.controller";
import {
  AssetReportQuerySchema,
  SpendQuerySchema,
  TechnicianWorkloadQuerySchema,
  ThroughputQuerySchema,
} from "./reports.schemas";

const router = Router();

// Reports are management-oriented — restricted to ADMIN and MANAGER.
const managers = authorize([Role.ADMIN, Role.MANAGER]);

/**
 * GET /api/v1/reports/assets
 * ADMIN + MANAGER — lifetime reliability per asset. Paginated, searchable,
 * filterable by category/status, sortable by any metric.
 */
router.get(
  "/assets",
  authenticate,
  managers,
  validateQuery(AssetReportQuerySchema),
  asyncHandler(reportsController.getAssetReliability),
);

/**
 * GET /api/v1/reports/technicians
 * ADMIN + MANAGER — current workload per technician. Paginated, searchable, sortable.
 */
router.get(
  "/technicians",
  authenticate,
  managers,
  validateQuery(TechnicianWorkloadQuerySchema),
  asyncHandler(reportsController.getTechnicianWorkload),
);

/**
 * GET /api/v1/reports/throughput
 * ADMIN + MANAGER — tasks created vs completed over time (day/week/month), with a summary.
 */
router.get(
  "/throughput",
  authenticate,
  managers,
  validateQuery(ThroughputQuerySchema),
  asyncHandler(reportsController.getThroughput),
);

/**
 * GET /api/v1/reports/spend
 * ADMIN + MANAGER — actual spend on received reorders, by period, supplier and category.
 */
router.get(
  "/spend",
  authenticate,
  managers,
  validateQuery(SpendQuerySchema),
  asyncHandler(reportsController.getSpend),
);

export default router;
