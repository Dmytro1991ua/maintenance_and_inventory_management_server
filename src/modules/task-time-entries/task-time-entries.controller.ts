import { Request, Response } from "express";

import { UnauthorizedError } from "../../errors";
import type {
  CreateTimeEntry,
  TimeEntryParams,
  TimeEntryTaskParam,
} from "./task-time-entries.schemas";
import { taskTimeEntriesService } from "./task-time-entries.service";

const requesterOf = (req: Request) => {
  if (!req.user) throw new UnauthorizedError("Not authenticated");

  return { id: req.user.id, roles: req.user.roles };
};

export const taskTimeEntriesController = {
  findAll: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as TimeEntryTaskParam;

    const data = await taskTimeEntriesService.findAllByTaskId(id, requesterOf(req));

    res.json({ success: true, data });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as TimeEntryTaskParam;

    const entry = await taskTimeEntriesService.create(
      id,
      requesterOf(req),
      req.body as CreateTimeEntry,
    );

    res.status(201).json({ success: true, data: entry });
  },

  delete: async (req: Request, res: Response): Promise<void> => {
    const { id, entryId } = req.params as TimeEntryParams;

    await taskTimeEntriesService.delete(id, entryId, requesterOf(req));

    res.status(204).send();
  },
};
