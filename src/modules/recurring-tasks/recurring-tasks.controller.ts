import { Request, Response } from "express";

import { UnauthorizedError } from "../../errors";
import type {
  CreateRecurringTask,
  RecurringTaskIdParam,
  RecurringTasksQuery,
  UpdateRecurringTask,
} from "./recurring-tasks.schemas";
import { recurringTasksService } from "./recurring-tasks.service";

export const recurringTasksController = {
  findAll: async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as RecurringTasksQuery;

    const result = await recurringTasksService.findAll(query);

    res.json({ success: true, ...result });
  },
  findById: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as RecurringTaskIdParam;

    const schedule = await recurringTasksService.findById(id);

    res.json({ success: true, data: schedule });
  },
  create: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const data = req.body as CreateRecurringTask;

    const schedule = await recurringTasksService.create(data, req.user.id);

    res.status(201).json({ success: true, data: schedule });
  },
  update: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as RecurringTaskIdParam;

    const data = req.body as UpdateRecurringTask;

    const schedule = await recurringTasksService.update(id, data);

    res.json({ success: true, data: schedule });
  },
  pause: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as RecurringTaskIdParam;

    const schedule = await recurringTasksService.pause(id);

    res.json({ success: true, data: schedule });
  },
  resume: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as RecurringTaskIdParam;

    const schedule = await recurringTasksService.resume(id);

    res.json({ success: true, data: schedule });
  },
  delete: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as RecurringTaskIdParam;

    await recurringTasksService.delete(id);

    res.status(204).send();
  },
};
