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
import { assetDowntimesController } from "./asset-downtimes.controller";
import {
  DowntimeAssetParamSchema,
  DowntimeParamsSchema,
  DowntimeQuerySchema,
  EndDowntimeSchema,
  StartDowntimeSchema,
} from "./asset-downtimes.schemas";

// mergeParams: true so `:id` (assetId) from the parent assets router is accessible
const router = Router({ mergeParams: true });

router.get(
  "/",
  authenticate,
  validateParams(DowntimeAssetParamSchema),
  validateQuery(DowntimeQuerySchema),
  asyncHandler(assetDowntimesController.findAll),
);

router.post(
  "/",
  authenticate,
  validateParams(DowntimeAssetParamSchema),
  validateBody(StartDowntimeSchema),
  asyncHandler(assetDowntimesController.start),
);

router.post(
  "/:downtimeId/end",
  authenticate,
  validateParams(DowntimeParamsSchema),
  validateBody(EndDowntimeSchema),
  asyncHandler(assetDowntimesController.end),
);

router.delete(
  "/:downtimeId",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateParams(DowntimeParamsSchema),
  asyncHandler(assetDowntimesController.delete),
);

export default router;
