import { prisma } from "../../config";
import { TASK_COMMENT_SELECT } from "./task-comments.constants";

export const taskCommentsRepository = {
  findAllByTaskId: (taskId: string) =>
    prisma.taskComment.findMany({
      where: { taskId },
      select: TASK_COMMENT_SELECT,
      orderBy: { createdAt: "asc" },
    }),

  findById: (id: string) =>
    prisma.taskComment.findUnique({ where: { id }, select: TASK_COMMENT_SELECT }),

  create: (data: { taskId: string; authorId: string; body: string }) =>
    prisma.taskComment.create({ data, select: TASK_COMMENT_SELECT }),

  delete: (id: string) => prisma.taskComment.delete({ where: { id } }),
};
