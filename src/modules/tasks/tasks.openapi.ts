import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  CreateTaskSchema,
  TaskIdParamSchema,
  TaskResponseSchema,
  TasksListResponseSchema,
  TasksQuerySchema,
  UpdateTaskSchema,
} from "./tasks.schemas";

const bearerAuth = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/tasks",
  description:
    "List tasks. Supports search (title + description), `status`, `assignedTo`, and `overdue=true` filters.",
  tags: ["Tasks"],
  security: bearerAuth,
  request: { query: TasksQuerySchema },
  responses: {
    200: {
      description: "Paginated list of tasks",
      content: { "application/json": { schema: TasksListResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/tasks/{id}",
  description: "Get a single task by ID.",
  tags: ["Tasks"],
  security: bearerAuth,
  request: { params: TaskIdParamSchema },
  responses: {
    200: {
      description: "Task found",
      content: { "application/json": { schema: TaskResponseSchema } },
    },
    404: {
      description: "Task not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/tasks",
  description: "Create a new task. Requires ADMIN or MANAGER role.",
  tags: ["Tasks"],
  security: bearerAuth,
  request: {
    body: { content: { "application/json": { schema: CreateTaskSchema } } },
  },
  responses: {
    201: {
      description: "Task created",
      content: { "application/json": { schema: TaskResponseSchema } },
    },
    403: {
      description: "Insufficient permissions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/tasks/{id}",
  description:
    "Update a task. ADMIN/MANAGER may update any field. TECHNICIAN may only update `status` on tasks assigned to them.",
  tags: ["Tasks"],
  security: bearerAuth,
  request: {
    params: TaskIdParamSchema,
    body: { content: { "application/json": { schema: UpdateTaskSchema } } },
  },
  responses: {
    200: {
      description: "Task updated",
      content: { "application/json": { schema: TaskResponseSchema } },
    },
    403: {
      description:
        "Technician attempting to update a task not assigned to them, or sending fields other than status",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Task not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/tasks/{id}",
  description: "Delete a task. ADMIN only.",
  tags: ["Tasks"],
  security: bearerAuth,
  request: { params: TaskIdParamSchema },
  responses: {
    204: { description: "Task deleted" },
    403: {
      description: "ADMIN role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Task not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
