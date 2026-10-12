import { NextFunction, Request, Response, Router } from "express";

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
  CreateMeterRecurringTaskSchema,
  CreateTimeRecurringTaskSchema,
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

// A meterId selects the meter schema, else time-based; not a union, to keep errors field-level.
const validateTimeBody = validateBody(CreateTimeRecurringTaskSchema);
const validateMeterBody = validateBody(CreateMeterRecurringTaskSchema);

const validateCreateBody = (req: Request, res: Response, next: NextFunction): void => {
  const isMeter = typeof req.body === "object" && req.body !== null && "meterId" in req.body;

  (isMeter ? validateMeterBody : validateTimeBody)(req, res, next);
};

router.post(
  "/",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateCreateBody,
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
