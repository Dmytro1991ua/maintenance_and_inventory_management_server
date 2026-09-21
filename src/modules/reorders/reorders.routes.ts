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
import { reordersController } from "./reorders.controller";
import { CreateReorderSchema, ReorderIdParamSchema, ReordersQuerySchema } from "./reorders.schemas";

const router = Router();

// Whole module is ADMIN/MANAGER — reorders are a purchasing/triage concern.
router.use(authenticate, authorize([Role.ADMIN, Role.MANAGER]));

/**
 * GET /api/v1/reorders
 * Paginated list; filter by status and inventoryItemId.
 */
router.get("/", validateQuery(ReordersQuerySchema), asyncHandler(reordersController.findAll));

/**
 * POST /api/v1/reorders
 * Manually raise a reorder for an item (status PENDING). Rejected if the item
 * already has an open reorder.
 */
router.post("/", validateBody(CreateReorderSchema), asyncHandler(reordersController.create));

/**
 * PATCH /api/v1/reorders/:id/order
 * Mark a PENDING reorder as ORDERED (placed with the supplier).
 */
router.patch(
  "/:id/order",
  validateParams(ReorderIdParamSchema),
  asyncHandler(reordersController.markOrdered),
);

/**
 * PATCH /api/v1/reorders/:id/receive
 * Mark an ORDERED reorder as RECEIVED and increment the item's stock.
 */
router.patch(
  "/:id/receive",
  validateParams(ReorderIdParamSchema),
  asyncHandler(reordersController.receive),
);

/**
 * PATCH /api/v1/reorders/:id/cancel
 * Cancel an open (PENDING or ORDERED) reorder, reopening the item's loop.
 */
router.patch(
  "/:id/cancel",
  validateParams(ReorderIdParamSchema),
  asyncHandler(reordersController.cancel),
);

export default router;
