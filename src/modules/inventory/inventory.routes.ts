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
import { inventoryController } from "./inventory.controller";
import {
  CreateInventoryItemSchema,
  InventoryItemIdParamSchema,
  InventoryQuerySchema,
  UpdateInventoryItemSchema,
} from "./inventory.schemas";

const router = Router();

/**
 * GET /api/v1/inventory
 * All authenticated users — paginated, filtered, sorted.
 * Supports ?lowStock=true to filter items below minimum stock level.
 */
router.get(
  "/",
  authenticate,
  validateQuery(InventoryQuerySchema),
  asyncHandler(inventoryController.findAll),
);

/**
 * GET /api/v1/inventory/:id
 * All authenticated users — get single item by ID
 */
router.get(
  "/:id",
  authenticate,
  validateParams(InventoryItemIdParamSchema),
  asyncHandler(inventoryController.findById),
);

/**
 * POST /api/v1/inventory
 * ADMIN + MANAGER only — create new inventory item
 */
router.post(
  "/",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateBody(CreateInventoryItemSchema),
  asyncHandler(inventoryController.create),
);

/**
 * PATCH /api/v1/inventory/:id
 * ADMIN + MANAGER only — update name, quantity, or minStockLevel
 * Note: serialNumber is not updatable by design
 */
router.patch(
  "/:id",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateParams(InventoryItemIdParamSchema),
  validateBody(UpdateInventoryItemSchema),
  asyncHandler(inventoryController.update),
);

/**
 * DELETE /api/v1/inventory/:id
 * ADMIN only — permanently remove an inventory item
 */
router.delete(
  "/:id",
  authenticate,
  authorize([Role.ADMIN]),
  validateParams(InventoryItemIdParamSchema),
  asyncHandler(inventoryController.delete),
);

export default router;
