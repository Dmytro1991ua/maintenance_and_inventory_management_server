import { prisma } from "../../../src/config";
import type { TaskComment } from "../../../src/generated/prisma/client";

type CreateTestTaskCommentOptions = {
  taskId: string;
  authorId: string;
  body?: string;
  createdAt?: Date;
};

export const createTestTaskComment = (
  options: CreateTestTaskCommentOptions,
): Promise<TaskComment> =>
  prisma.taskComment.create({
    data: {
      taskId: options.taskId,
      authorId: options.authorId,
      body: options.body ?? "Checked the unit, all nominal.",
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    },
  });
