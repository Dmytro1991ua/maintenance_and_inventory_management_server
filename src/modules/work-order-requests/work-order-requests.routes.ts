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
import { workOrderRequestsController } from "./work-order-requests.controller";
import {
  ApproveWorkOrderRequestSchema,
  CreateWorkOrderRequestSchema,
  RejectWorkOrderRequestSchema,
  WorkOrderRequestIdParamSchema,
  WorkOrderRequestsQuerySchema,
} from "./work-order-requests.schemas";

const router = Router();

const managers = authorize([Role.ADMIN, Role.MANAGER]);

/**
 * POST /api/v1/work-order-requests
 * Any authenticated user — file a maintenance request (status PENDING).
 */
router.post(
  "/",
  authenticate,
  validateBody(CreateWorkOrderRequestSchema),
  asyncHandler(workOrderRequestsController.create),
);

/**
 * GET /api/v1/work-order-requests
 * Any authenticated user — ADMIN/MANAGER see the whole queue; others see only
 * their own. Paginated; filter by status; search title/description.
 */
router.get(
  "/",
  authenticate,
  validateQuery(WorkOrderRequestsQuerySchema),
  asyncHandler(workOrderRequestsController.findAll),
);

/**
 * GET /api/v1/work-order-requests/:id
 * Owner or ADMIN/MANAGER.
 */
router.get(
  "/:id",
  authenticate,
  validateParams(WorkOrderRequestIdParamSchema),
  asyncHandler(workOrderRequestsController.findById),
);

/**
 * POST /api/v1/work-order-requests/:id/approve
 * ADMIN/MANAGER — creates a task from the request and marks it APPROVED.
 */
router.post(
  "/:id/approve",
  authenticate,
  managers,
  validateParams(WorkOrderRequestIdParamSchema),
  validateBody(ApproveWorkOrderRequestSchema),
  asyncHandler(workOrderRequestsController.approve),
);

/**
 * POST /api/v1/work-order-requests/:id/reject
 * ADMIN/MANAGER — marks the request REJECTED with a required reason.
 */
router.post(
  "/:id/reject",
  authenticate,
  managers,
  validateParams(WorkOrderRequestIdParamSchema),
  validateBody(RejectWorkOrderRequestSchema),
  asyncHandler(workOrderRequestsController.reject),
);

export default router;
