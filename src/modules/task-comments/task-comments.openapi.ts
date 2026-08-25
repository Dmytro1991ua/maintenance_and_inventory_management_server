import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  CreateTaskCommentSchema,
  TaskCommentParamsSchema,
  TaskCommentResponseSchema,
  TaskCommentsListResponseSchema,
  TaskCommentTaskParamSchema,
} from "./task-comments.schemas";

const bearerAuth = [{ bearerAuth: [] }];

const taskNotFound = {
  description: "Task not found",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

registry.registerPath({
  method: "get",
  path: "/tasks/{id}/comments",
  description: "List all comments for a task, ordered oldest first. All authenticated roles.",
  tags: ["Task Comments"],
  security: bearerAuth,
  request: { params: TaskCommentTaskParamSchema },
  responses: {
    200: {
      description: "Comments list",
      content: { "application/json": { schema: TaskCommentsListResponseSchema } },
    },
    404: taskNotFound,
  },
});

registry.registerPath({
  method: "post",
  path: "/tasks/{id}/comments",
  description: "Add a comment to a task. All authenticated roles.",
  tags: ["Task Comments"],
  security: bearerAuth,
  request: {
    params: TaskCommentTaskParamSchema,
    body: { content: { "application/json": { schema: CreateTaskCommentSchema } } },
  },
  responses: {
    201: {
      description: "Comment created",
      content: { "application/json": { schema: TaskCommentResponseSchema } },
    },
    404: taskNotFound,
  },
});

registry.registerPath({
  method: "delete",
  path: "/tasks/{id}/comments/{commentId}",
  description: "Delete a comment. Authors can delete their own; ADMIN can delete any.",
  tags: ["Task Comments"],
  security: bearerAuth,
  request: { params: TaskCommentParamsSchema },
  responses: {
    204: { description: "Deleted" },
    403: {
      description: "Not your comment",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Comment not found, or it does not belong to this task",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
