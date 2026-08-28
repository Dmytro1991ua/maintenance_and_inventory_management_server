import { Request, Response } from "express";

import type { TasksQuery } from "../tasks/tasks.schemas";
import type { AssetIdParam, AssetsQuery, CreateAsset, UpdateAsset } from "./assets.schemas";
import { assetsService } from "./assets.service";

/**
 * Assets controller — HTTP layer only.
 */
export const assetsController = {
  getCategories: (_req: Request, res: Response): void => {
    res.json({ success: true, data: assetsService.getCategories() });
  },

  getStats: async (_req: Request, res: Response): Promise<void> => {
    const stats = await assetsService.getStats();
    res.json({ success: true, data: stats });
  },

  findAll: async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AssetsQuery;

    const result = await assetsService.findAll(query);

    res.json({ success: true, ...result });
  },
  findById: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as AssetIdParam;

    const asset = await assetsService.findById(id);

    res.json({ success: true, data: asset });
  },
  findTasks: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as AssetIdParam;
    const query = req.query as unknown as TasksQuery;

    const result = await assetsService.findTasks(id, query);

    res.json({ success: true, ...result });
  },
  create: async (req: Request, res: Response): Promise<void> => {
    const data = req.body as CreateAsset;
    const asset = await assetsService.create(data);

    res.status(201).json({ success: true, data: asset });
  },
  update: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as AssetIdParam;

    const data = req.body as UpdateAsset;

    const asset = await assetsService.update(id, data);

    res.json({ success: true, data: asset });
  },
  delete: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as AssetIdParam;

    await assetsService.delete(id);

    res.status(204).send();
  },
};
