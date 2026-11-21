import { Request, Response } from "express";

import { UnauthorizedError } from "../../errors";
import type {
  DowntimeAssetParam,
  DowntimeParams,
  DowntimeQuery,
  EndDowntime,
  StartDowntime,
} from "./asset-downtimes.schemas";
import { assetDowntimesService } from "./asset-downtimes.service";

export const assetDowntimesController = {
  findAll: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as DowntimeAssetParam;

    const data = await assetDowntimesService.findAll(id, req.query as unknown as DowntimeQuery);

    res.json({ success: true, data });
  },

  start: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id } = req.params as DowntimeAssetParam;

    const event = await assetDowntimesService.start(id, req.user.id, req.body as StartDowntime);

    res.status(201).json({ success: true, data: event });
  },

  end: async (req: Request, res: Response): Promise<void> => {
    const { id, downtimeId } = req.params as DowntimeParams;

    const event = await assetDowntimesService.end(id, downtimeId, req.body as EndDowntime);

    res.json({ success: true, data: event });
  },

  delete: async (req: Request, res: Response): Promise<void> => {
    const { id, downtimeId } = req.params as DowntimeParams;

    await assetDowntimesService.delete(id, downtimeId);

    res.status(204).send();
  },
};
