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
import { TasksQuerySchema } from "../tasks/tasks.schemas";
import { assetsController } from "./assets.controller";
import {
  AssetIdParamSchema,
  AssetsQuerySchema,
  CreateAssetSchema,
  UpdateAssetSchema,
} from "./assets.schemas";

const router = Router();

/**
 * GET /api/v1/assets/categories
 * All authenticated users — static list of valid category values.
 * Must be registered before /:id so Express doesn't treat "categories" as an ID.
 */
router.get("/categories", authenticate, assetsController.getCategories);

/**
 * GET /api/v1/assets/stats
 * All authenticated users — aggregate counts by status and category for the dashboard.
 * Must be registered before /:id so Express doesn't treat "stats" as an ID.
 */
router.get("/stats", authenticate, asyncHandler(assetsController.getStats));

/**
 * GET /api/v1/assets
 * All authenticated users — paginated, filtered, sorted.
 * Supports ?category=HVAC and ?status=DOWN filters.
 */
router.get(
  "/",
  authenticate,
  validateQuery(AssetsQuerySchema),
  asyncHandler(assetsController.findAll),
);

/**
 * GET /api/v1/assets/:id/tasks
 * All authenticated users — maintenance history for one asset.
 * Reuses the tasks list query (pagination, sort, filters), scoped to this asset.
 * Must be registered before /:id so Express doesn't treat "tasks" as part of the ID route.
 */
router.get(
  "/:id/tasks",
  authenticate,
  validateParams(AssetIdParamSchema),
  validateQuery(TasksQuerySchema),
  asyncHandler(assetsController.findTasks),
);

/**
 * GET /api/v1/assets/:id
 * All authenticated users — get single asset by ID
 */
router.get(
  "/:id",
  authenticate,
  validateParams(AssetIdParamSchema),
  asyncHandler(assetsController.findById),
);

/**
 * POST /api/v1/assets
 * ADMIN + MANAGER only — register a new asset
 */
router.post(
  "/",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateBody(CreateAssetSchema),
  asyncHandler(assetsController.create),
);

/**
 * PATCH /api/v1/assets/:id
 * ADMIN + MANAGER only — update asset fields (serialNumber is not updatable)
 */
router.patch(
  "/:id",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateParams(AssetIdParamSchema),
  validateBody(UpdateAssetSchema),
  asyncHandler(assetsController.update),
);

/**
 * DELETE /api/v1/assets/:id
 * ADMIN only — permanently remove an asset (its tasks' assetId is nulled)
 */
router.delete(
  "/:id",
  authenticate,
  authorize([Role.ADMIN]),
  validateParams(AssetIdParamSchema),
  asyncHandler(assetsController.delete),
);

export default router;
