import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  CompleteTaskSchema,
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
    "List tasks. Supports search, status, priority, category, assignedTo, overdue, and date range filters.",
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
    "Update a task. ADMIN/MANAGER may update any field. TECHNICIAN may only update status on tasks assigned to them.",
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
      description: "Insufficient permissions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Task not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/tasks/{id}/before-photo",
  description:
    "Upload a before photo for a task (multipart/form-data, field: photo). TECHNICIAN must be assigned to the task.",
  tags: ["Tasks"],
  security: bearerAuth,
  request: { params: TaskIdParamSchema },
  responses: {
    200: {
      description: "Before photo uploaded",
      content: { "application/json": { schema: TaskResponseSchema } },
    },
    400: {
      description: "No file provided or invalid file type",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Not assigned to this task",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Task not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/tasks/{id}/after-photo",
  description:
    "Upload an after photo for a task (multipart/form-data, field: photo). Required before completing the task.",
  tags: ["Tasks"],
  security: bearerAuth,
  request: { params: TaskIdParamSchema },
  responses: {
    200: {
      description: "After photo uploaded",
      content: { "application/json": { schema: TaskResponseSchema } },
    },
    400: {
      description: "No file provided or invalid file type",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Not assigned to this task",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Task not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/tasks/{id}/complete",
  description:
    "Complete a task. Requires after photo to be uploaded first. Validates checklist against the category template and decrements inventory for parts used.",
  tags: ["Tasks"],
  security: bearerAuth,
  request: {
    params: TaskIdParamSchema,
    body: { content: { "application/json": { schema: CompleteTaskSchema } } },
  },
  responses: {
    200: {
      description: "Task completed",
      content: { "application/json": { schema: TaskResponseSchema } },
    },
    400: {
      description: "After photo missing or checklist incomplete",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "Not assigned to this task",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Task or inventory item not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Task already completed or insufficient inventory stock",
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
