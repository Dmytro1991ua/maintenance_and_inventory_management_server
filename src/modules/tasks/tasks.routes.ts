import { Router } from "express";

import { Role } from "../../generated/prisma/client";
import {
  asyncHandler,
  authenticate,
  authorize,
  uploadPhotoMiddleware,
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware";
import { tasksController } from "./tasks.controller";
import {
  CompleteTaskSchema,
  CreateTaskSchema,
  TaskIdParamSchema,
  TasksQuerySchema,
  UpdateTaskSchema,
} from "./tasks.schemas";

const router = Router();

router.get(
  "/",
  authenticate,
  validateQuery(TasksQuerySchema),
  asyncHandler(tasksController.findAll),
);

router.get(
  "/:id",
  authenticate,
  validateParams(TaskIdParamSchema),
  asyncHandler(tasksController.findById),
);

router.post(
  "/",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateBody(CreateTaskSchema),
  asyncHandler(tasksController.create),
);

router.patch(
  "/:id",
  authenticate,
  validateParams(TaskIdParamSchema),
  validateBody(UpdateTaskSchema),
  asyncHandler(tasksController.update),
);

/**
 * POST /api/v1/tasks/:id/before-photo
 * Upload a "before" photo for a task. Multipart field: photo.
 * TECHNICIAN (assigned to task) or ADMIN/MANAGER.
 */
router.post(
  "/:id/before-photo",
  authenticate,
  validateParams(TaskIdParamSchema),
  uploadPhotoMiddleware,
  asyncHandler(tasksController.uploadBeforePhoto),
);

/**
 * POST /api/v1/tasks/:id/after-photo
 * Upload an "after" photo for a task. Multipart field: photo.
 * TECHNICIAN (assigned to task) or ADMIN/MANAGER.
 */
router.post(
  "/:id/after-photo",
  authenticate,
  validateParams(TaskIdParamSchema),
  uploadPhotoMiddleware,
  asyncHandler(tasksController.uploadAfterPhoto),
);

/**
 * POST /api/v1/tasks/:id/complete
 * Complete a task — validates after photo, checklist, and records parts used.
 * TECHNICIAN (assigned to task) or ADMIN/MANAGER.
 */
router.post(
  "/:id/complete",
  authenticate,
  validateParams(TaskIdParamSchema),
  validateBody(CompleteTaskSchema),
  asyncHandler(tasksController.complete),
);

router.delete(
  "/:id",
  authenticate,
  authorize([Role.ADMIN]),
  validateParams(TaskIdParamSchema),
  asyncHandler(tasksController.delete),
);

export default router;
