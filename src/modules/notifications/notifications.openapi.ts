import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  MarkAllReadResponseSchema,
  NotificationIdParamSchema,
  NotificationResponseSchema,
  NotificationsListResponseSchema,
  NotificationsQuerySchema,
  UnreadCountResponseSchema,
  UpdateNotificationSchema,
} from "./notifications.schemas";

const bearerAuth = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/notifications",
  description:
    "List the authenticated user's notifications. Filterable by `isRead` and `type` (`LOW_STOCK`, `OUT_OF_STOCK`, `TASK_OVERDUE`), always sorted newest first.",
  tags: ["Notifications"],
  security: bearerAuth,
  request: { query: NotificationsQuerySchema },
  responses: {
    200: {
      description: "Paginated list of notifications",
      content: { "application/json": { schema: NotificationsListResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/notifications/unread-count",
  description: "Get the count of unread notifications for the authenticated user.",
  tags: ["Notifications"],
  security: bearerAuth,
  responses: {
    200: {
      description: "Unread count",
      content: { "application/json": { schema: UnreadCountResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/notifications/read-all",
  description: "Mark all of the authenticated user's unread notifications as read.",
  tags: ["Notifications"],
  security: bearerAuth,
  responses: {
    200: {
      description: "Notifications marked as read",
      content: { "application/json": { schema: MarkAllReadResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/notifications/{id}",
  description:
    "Mark a single notification as read or unread. Users may only update their own notifications.",
  tags: ["Notifications"],
  security: bearerAuth,
  request: {
    params: NotificationIdParamSchema,
    body: { content: { "application/json": { schema: UpdateNotificationSchema } } },
  },
  responses: {
    200: {
      description: "Notification updated",
      content: { "application/json": { schema: NotificationResponseSchema } },
    },
    403: {
      description: "Not your notification",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Notification not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/notifications/{id}",
  description: "Delete a notification. Users may only delete their own notifications.",
  tags: ["Notifications"],
  security: bearerAuth,
  request: { params: NotificationIdParamSchema },
  responses: {
    204: { description: "Notification deleted" },
    403: {
      description: "Not your notification",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Notification not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
