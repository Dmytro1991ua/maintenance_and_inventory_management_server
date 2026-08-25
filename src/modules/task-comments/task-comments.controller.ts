import { Request, Response } from "express";

import { UnauthorizedError } from "../../errors";
import type {
  CreateTaskComment,
  TaskCommentParams,
  TaskCommentTaskParam,
} from "./task-comments.schemas";
import { taskCommentsService } from "./task-comments.service";

export const taskCommentsController = {
  findAll: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as TaskCommentTaskParam;

    const comments = await taskCommentsService.findAllByTaskId(id);

    res.json({ success: true, data: comments });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id } = req.params as TaskCommentTaskParam;
    const { body } = req.body as CreateTaskComment;

    const comment = await taskCommentsService.create(id, req.user.id, body);

    res.status(201).json({ success: true, data: comment });
  },

  delete: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id, commentId } = req.params as TaskCommentParams;

    await taskCommentsService.delete(id, commentId, {
      id: req.user.id,
      roles: req.user.roles,
    });

    res.status(204).send();
  },
};
