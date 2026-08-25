import { Router } from "express";

import { asyncHandler, authenticate, validateBody, validateParams } from "../../middleware";
import { taskCommentsController } from "./task-comments.controller";
import {
  CreateTaskCommentSchema,
  TaskCommentParamsSchema,
  TaskCommentTaskParamSchema,
} from "./task-comments.schemas";

// mergeParams: true so `:id` (taskId) from the parent tasks router is accessible
const router = Router({ mergeParams: true });

router.get(
  "/",
  authenticate,
  validateParams(TaskCommentTaskParamSchema),
  asyncHandler(taskCommentsController.findAll),
);

router.post(
  "/",
  authenticate,
  validateParams(TaskCommentTaskParamSchema),
  validateBody(CreateTaskCommentSchema),
  asyncHandler(taskCommentsController.create),
);

router.delete(
  "/:commentId",
  authenticate,
  validateParams(TaskCommentParamsSchema),
  asyncHandler(taskCommentsController.delete),
);

export default router;
