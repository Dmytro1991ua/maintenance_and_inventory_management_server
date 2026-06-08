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
import { tasksController } from "./tasks.controller";
import {
  CreateTaskSchema,
  TaskIdParamSchema,
  TasksQuerySchema,
  UpdateTaskSchema,
} from "./tasks.schemas";

const router = Router();

/**
 * GET /api/v1/tasks
 * All authenticated users — paginated, filtered by status or assignee
 */
router.get(
  "/",
  authenticate,
  validateQuery(TasksQuerySchema),
  asyncHandler(tasksController.findAll),
);

/**
 * GET /api/v1/tasks/:id
 * All authenticated users
 */
router.get(
  "/:id",
  authenticate,
  validateParams(TaskIdParamSchema),
  asyncHandler(tasksController.findById),
);

/**
 * POST /api/v1/tasks
 * ADMIN + MANAGER only — create and optionally assign a task
 */
router.post(
  "/",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateBody(CreateTaskSchema),
  asyncHandler(tasksController.create),
);

/**
 * PATCH /api/v1/tasks/:id
 * ADMIN + MANAGER → full update (title, description, status, assignee)
 * TECHNICIAN      → status only, on tasks assigned to them
 */
router.patch(
  "/:id",
  authenticate,
  validateParams(TaskIdParamSchema),
  validateBody(UpdateTaskSchema),
  asyncHandler(tasksController.update),
);

/**
 * DELETE /api/v1/tasks/:id
 * ADMIN only
 */
router.delete(
  "/:id",
  authenticate,
  authorize([Role.ADMIN]),
  validateParams(TaskIdParamSchema),
  asyncHandler(tasksController.delete),
);

export default router;
