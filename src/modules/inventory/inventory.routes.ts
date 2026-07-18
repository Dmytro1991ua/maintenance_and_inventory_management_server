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
  RestockInventoryItemSchema,
  UpdateInventoryItemSchema,
} from "./inventory.schemas";

const router = Router();

/**
 * GET /api/v1/inventory/categories
 * All authenticated users — static list of valid category values.
 * Must be registered before /:id so Express doesn't treat "categories" as an ID.
 */
router.get("/categories", authenticate, inventoryController.getCategories);

/**
 * GET /api/v1/inventory
 * All authenticated users — paginated, filtered, sorted.
 * Supports ?lowStock=true and ?category=ELECTRICAL filters.
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
 * PATCH /api/v1/inventory/:id/restock
 * ADMIN + MANAGER only — increment quantity by quantityToAdd
 * Must be registered before /:id so Express doesn't treat "restock" as a body route on /:id
 */
router.patch(
  "/:id/restock",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateParams(InventoryItemIdParamSchema),
  validateBody(RestockInventoryItemSchema),
  asyncHandler(inventoryController.restock),
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
