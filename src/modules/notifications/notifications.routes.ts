import { Router } from "express";

import {
  asyncHandler,
  authenticate,
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware";
import { notificationsController } from "./notifications.controller";
import {
  NotificationIdParamSchema,
  NotificationsQuerySchema,
  UpdateNotificationSchema,
} from "./notifications.schemas";

const router = Router();

/**
 * GET /api/v1/notifications
 * Own notifications only — paginated, filterable by isRead
 */
router.get(
  "/",
  authenticate,
  validateQuery(NotificationsQuerySchema),
  asyncHandler(notificationsController.findAll),
);

/**
 * GET /api/v1/notifications/unread-count
 * Returns { count: number } — used for notification badge in UI.
 * Defined before /:id — "unread-count" must not be captured as an id param.
 */
router.get("/unread-count", authenticate, asyncHandler(notificationsController.countUnread));

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all own notifications as read.
 * Defined before /:id — same reason as unread-count.
 */
router.patch("/read-all", authenticate, asyncHandler(notificationsController.markAllAsRead));

/**
 * PATCH /api/v1/notifications/:id
 * Mark single notification as read or unread.
 * Ownership verified in service layer.
 */
router.patch(
  "/:id",
  authenticate,
  validateParams(NotificationIdParamSchema),
  validateBody(UpdateNotificationSchema),
  asyncHandler(notificationsController.update),
);

/**
 * DELETE /api/v1/notifications/:id
 * Delete own notification.
 * Ownership verified in service layer.
 */
router.delete(
  "/:id",
  authenticate,
  validateParams(NotificationIdParamSchema),
  asyncHandler(notificationsController.delete),
);

export default router;
