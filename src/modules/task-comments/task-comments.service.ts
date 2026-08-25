import { ForbiddenError, NotFoundError } from "../../errors";
import { Role } from "../../generated/prisma/client";
import { findOrThrow } from "../../utils";
import { tasksRepository } from "../tasks/tasks.repository";
import { TASK_COMMENT_NOT_FOUND_MESSAGE } from "./task-comments.constants";
import { taskCommentsRepository } from "./task-comments.repository";

const ensureTaskExists = (taskId: string) =>
  findOrThrow(() => tasksRepository.findIdById(taskId), "Task not found");

export const taskCommentsService = {
  findAllByTaskId: async (taskId: string) => {
    await ensureTaskExists(taskId);

    return taskCommentsRepository.findAllByTaskId(taskId);
  },

  create: async (taskId: string, authorId: string, body: string) => {
    await ensureTaskExists(taskId);

    return taskCommentsRepository.create({ taskId, authorId, body });
  },

  delete: async (
    taskId: string,
    commentId: string,
    requestingUser: { id: string; roles: Role[] },
  ): Promise<void> => {
    const comment = await findOrThrow(
      () => taskCommentsRepository.findById(commentId),
      TASK_COMMENT_NOT_FOUND_MESSAGE,
    );

    // The comment must belong to the task in the URL. 404 rather than 403 so a
    // mismatched pair can't be used to probe for comment ids on other tasks.
    if (comment.taskId !== taskId) {
      throw new NotFoundError(TASK_COMMENT_NOT_FOUND_MESSAGE);
    }

    const isAdmin = requestingUser.roles.includes(Role.ADMIN);

    if (!isAdmin && comment.author.id !== requestingUser.id) {
      throw new ForbiddenError("You can only delete your own comments");
    }

    await taskCommentsRepository.delete(commentId);
  },
};
