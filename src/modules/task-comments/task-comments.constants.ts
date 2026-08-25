import { Prisma } from "../../generated/prisma/client";

export const TASK_COMMENT_SELECT = {
  id: true,
  taskId: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, userName: true, email: true } },
} satisfies Prisma.TaskCommentSelect;

export const TASK_COMMENT_NOT_FOUND_MESSAGE = "Comment not found";
