import { Request, Response } from "express";

import { BadRequestError, UnauthorizedError } from "../../errors";
import type {
  CompleteTask,
  CreateTask,
  TaskIdParam,
  TasksQuery,
  UpdateTask,
} from "./tasks.schemas";
import { tasksService } from "./tasks.service";

const makeUploadPhotoHandler = (type: "before" | "after") => {
  return async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");
    if (!req.file) throw new BadRequestError("Photo file is required");

    const { id } = req.params as TaskIdParam;

    const caller = { id: req.user.id, roles: req.user.roles };

    const task =
      type === "before"
        ? await tasksService.uploadBeforePhoto(id, caller, req.file)
        : await tasksService.uploadAfterPhoto(id, caller, req.file);

    res.json({ success: true, data: task });
  };
};

/**
 * Tasks controller — HTTP layer only.
 */
export const tasksController = {
  findAll: async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as TasksQuery;

    const result = await tasksService.findAll(query);

    res.json({ success: true, ...result });
  },
  findById: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as TaskIdParam;

    const task = await tasksService.findById(id);

    res.json({ success: true, data: task });
  },
  create: async (req: Request, res: Response): Promise<void> => {
    const data = req.body as CreateTask;

    const task = await tasksService.create(data);

    res.status(201).json({ success: true, data: task });
  },
  update: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError("Not authenticated");
    }

    const { id } = req.params as TaskIdParam;
    const data = req.body as UpdateTask;

    const task = await tasksService.update(id, data, {
      id: req.user.id,
      roles: req.user.roles,
    });

    res.json({ success: true, data: task });
  },
  uploadBeforePhoto: makeUploadPhotoHandler("before"),
  uploadAfterPhoto: makeUploadPhotoHandler("after"),
  complete: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new UnauthorizedError("Not authenticated");
    }

    const { id } = req.params as TaskIdParam;

    const data = req.body as CompleteTask;

    const task = await tasksService.complete(id, { id: req.user.id, roles: req.user.roles }, data);

    res.json({ success: true, data: task });
  },
  delete: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as TaskIdParam;

    await tasksService.delete(id);

    res.status(204).send();
  },
};
