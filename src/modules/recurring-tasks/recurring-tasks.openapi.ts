import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  CreateRecurringTaskSchema,
  RecurringTaskIdParamSchema,
  RecurringTaskResponseSchema,
  RecurringTasksListResponseSchema,
  RecurringTasksQuerySchema,
  UpdateRecurringTaskSchema,
} from "./recurring-tasks.schemas";

const bearerAuth = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/recurring-tasks",
  description: "List recurring maintenance schedules. ADMIN/MANAGER only.",
  tags: ["Recurring Tasks"],
  security: bearerAuth,
  request: { query: RecurringTasksQuerySchema },
  responses: {
    200: {
      description: "Paginated list of recurring task schedules",
      content: { "application/json": { schema: RecurringTasksListResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/recurring-tasks/{id}",
  description: "Get a single recurring schedule by ID. ADMIN/MANAGER only.",
  tags: ["Recurring Tasks"],
  security: bearerAuth,
  request: { params: RecurringTaskIdParamSchema },
  responses: {
    200: {
      description: "Schedule found",
      content: { "application/json": { schema: RecurringTaskResponseSchema } },
    },
    404: {
      description: "Schedule not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/recurring-tasks",
  description:
    "Create a recurring maintenance schedule. The first task will be generated on firstDueAt; subsequent tasks are generated every intervalDays thereafter. ADMIN/MANAGER only.",
  tags: ["Recurring Tasks"],
  security: bearerAuth,
  request: {
    body: { content: { "application/json": { schema: CreateRecurringTaskSchema } } },
  },
  responses: {
    201: {
      description: "Schedule created",
      content: { "application/json": { schema: RecurringTaskResponseSchema } },
    },
    404: {
      description: "Assignee not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/recurring-tasks/{id}",
  description:
    "Update a recurring schedule's title, interval, assignee, or other fields. ADMIN/MANAGER only.",
  tags: ["Recurring Tasks"],
  security: bearerAuth,
  request: {
    params: RecurringTaskIdParamSchema,
    body: { content: { "application/json": { schema: UpdateRecurringTaskSchema } } },
  },
  responses: {
    200: {
      description: "Schedule updated",
      content: { "application/json": { schema: RecurringTaskResponseSchema } },
    },
    404: {
      description: "Schedule or assignee not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/recurring-tasks/{id}/pause",
  description: "Pause a schedule — no tasks will be generated until resumed. ADMIN/MANAGER only.",
  tags: ["Recurring Tasks"],
  security: bearerAuth,
  request: { params: RecurringTaskIdParamSchema },
  responses: {
    200: {
      description: "Schedule paused",
      content: { "application/json": { schema: RecurringTaskResponseSchema } },
    },
    404: {
      description: "Schedule not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Schedule is already paused",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/recurring-tasks/{id}/resume",
  description: "Resume a paused schedule. ADMIN/MANAGER only.",
  tags: ["Recurring Tasks"],
  security: bearerAuth,
  request: { params: RecurringTaskIdParamSchema },
  responses: {
    200: {
      description: "Schedule resumed",
      content: { "application/json": { schema: RecurringTaskResponseSchema } },
    },
    404: {
      description: "Schedule not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Schedule is already active",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/recurring-tasks/{id}",
  description:
    "Delete a recurring schedule. Generated tasks are kept but lose their schedule link. ADMIN only.",
  tags: ["Recurring Tasks"],
  security: bearerAuth,
  request: { params: RecurringTaskIdParamSchema },
  responses: {
    204: { description: "Schedule deleted" },
    403: {
      description: "ADMIN role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Schedule not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
