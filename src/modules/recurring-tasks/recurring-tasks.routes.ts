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
import { recurringTasksController } from "./recurring-tasks.controller";
import {
  CreateRecurringTaskSchema,
  RecurringTaskIdParamSchema,
  RecurringTasksQuerySchema,
  UpdateRecurringTaskSchema,
} from "./recurring-tasks.schemas";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateQuery(RecurringTasksQuerySchema),
  asyncHandler(recurringTasksController.findAll),
);

router.get(
  "/:id",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateParams(RecurringTaskIdParamSchema),
  asyncHandler(recurringTasksController.findById),
);

router.post(
  "/",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateBody(CreateRecurringTaskSchema),
  asyncHandler(recurringTasksController.create),
);

router.patch(
  "/:id",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateParams(RecurringTaskIdParamSchema),
  validateBody(UpdateRecurringTaskSchema),
  asyncHandler(recurringTasksController.update),
);

/**
 * POST /api/v1/recurring-tasks/:id/pause
 * Pause a recurring schedule — no new tasks will be generated until resumed.
 */
router.post(
  "/:id/pause",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateParams(RecurringTaskIdParamSchema),
  asyncHandler(recurringTasksController.pause),
);

/**
 * POST /api/v1/recurring-tasks/:id/resume
 * Resume a paused recurring schedule.
 */
router.post(
  "/:id/resume",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateParams(RecurringTaskIdParamSchema),
  asyncHandler(recurringTasksController.resume),
);

router.delete(
  "/:id",
  authenticate,
  authorize([Role.ADMIN]),
  validateParams(RecurringTaskIdParamSchema),
  asyncHandler(recurringTasksController.delete),
);

export default router;
