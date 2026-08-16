import { Router } from "express";

import { Role } from "../../generated/prisma/client";
import {
  asyncHandler,
  authenticate,
  authorize,
  validateBody,
  validateParams,
} from "../../middleware";
import { checklistTemplatesController } from "./checklist-templates.controller";
import {
  ChecklistCategoryParamSchema,
  UpdateChecklistTemplateSchema,
} from "./checklist-templates.schemas";

const router = Router();

/**
 * GET /api/v1/checklist-templates
 * All authenticated users — list all category templates
 */
router.get("/", authenticate, asyncHandler(checklistTemplatesController.findAll));

/**
 * GET /api/v1/checklist-templates/:category
 * All authenticated users — get template for a specific category
 */
router.get(
  "/:category",
  authenticate,
  validateParams(ChecklistCategoryParamSchema),
  asyncHandler(checklistTemplatesController.findByCategory),
);

/**
 * PATCH /api/v1/checklist-templates/:category
 * ADMIN + MANAGER only — update checklist items for a category
 */
router.patch(
  "/:category",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateParams(ChecklistCategoryParamSchema),
  validateBody(UpdateChecklistTemplateSchema),
  asyncHandler(checklistTemplatesController.updateByCategory),
);

export default router;
