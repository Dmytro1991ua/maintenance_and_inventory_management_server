import { Router } from "express";

import { Role } from "../../generated/prisma/client";
import {
  asyncHandler,
  authenticate,
  authorize,
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware";
import { metersController } from "./meters.controller";
import {
  CreateMeterSchema,
  MeterIdParamSchema,
  MetersQuerySchema,
  ReadingsQuerySchema,
  RecordReadingSchema,
  UpdateMeterSchema,
} from "./meters.schemas";

const router = Router();

const managers = authorize([Role.ADMIN, Role.MANAGER]);

/**
 * GET /api/v1/meters
 * All authenticated users — paginated; filter by ?assetId.
 */
router.get(
  "/",
  authenticate,
  validateQuery(MetersQuerySchema),
  asyncHandler(metersController.findAll),
);

/**
 * POST /api/v1/meters
 * ADMIN/MANAGER — add a meter to an asset, logging its initial reading.
 */
router.post(
  "/",
  authenticate,
  managers,
  validateBody(CreateMeterSchema),
  asyncHandler(metersController.create),
);

/**
 * PATCH /api/v1/meters/:id
 * ADMIN/MANAGER — rename a meter (the unit is fixed once created).
 */
router.patch(
  "/:id",
  authenticate,
  managers,
  validateParams(MeterIdParamSchema),
  validateBody(UpdateMeterSchema),
  asyncHandler(metersController.update),
);

/**
 * DELETE /api/v1/meters/:id
 * ADMIN/MANAGER — removes the meter and its reading history.
 */
router.delete(
  "/:id",
  authenticate,
  managers,
  validateParams(MeterIdParamSchema),
  asyncHandler(metersController.delete),
);

/**
 * GET /api/v1/meters/:id/readings
 * All authenticated users — reading history, newest first.
 */
router.get(
  "/:id/readings",
  authenticate,
  validateParams(MeterIdParamSchema),
  validateQuery(ReadingsQuerySchema),
  asyncHandler(metersController.findReadings),
);

/**
 * POST /api/v1/meters/:id/readings
 * Any authenticated role, technicians included — they're the ones at the machine.
 * Rejected (409) if the value is lower than the current reading.
 */
router.post(
  "/:id/readings",
  authenticate,
  validateParams(MeterIdParamSchema),
  validateBody(RecordReadingSchema),
  asyncHandler(metersController.recordReading),
);

export default router;
