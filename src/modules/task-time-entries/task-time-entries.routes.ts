import { Router } from "express";

import { asyncHandler, authenticate, validateBody, validateParams } from "../../middleware";
import { taskTimeEntriesController } from "./task-time-entries.controller";
import {
  CreateTimeEntrySchema,
  TimeEntryParamsSchema,
  TimeEntryTaskParamSchema,
} from "./task-time-entries.schemas";

// mergeParams: true so `:id` (taskId) from the parent tasks router is accessible
const router = Router({ mergeParams: true });

router.get(
  "/",
  authenticate,
  validateParams(TimeEntryTaskParamSchema),
  asyncHandler(taskTimeEntriesController.findAll),
);

router.post(
  "/",
  authenticate,
  validateParams(TimeEntryTaskParamSchema),
  validateBody(CreateTimeEntrySchema),
  asyncHandler(taskTimeEntriesController.create),
);

router.delete(
  "/:entryId",
  authenticate,
  validateParams(TimeEntryParamsSchema),
  asyncHandler(taskTimeEntriesController.delete),
);

export default router;
