import { Request, Response } from "express";

import type { ThroughputQuery } from "./reports.schemas";
import { reportsService } from "./reports.service";

/**
 * Reports controller — HTTP layer only.
 */
export const reportsController = {
  getAssetReliability: async (_req: Request, res: Response): Promise<void> => {
    const data = await reportsService.getAssetReliability();

    res.json({ success: true, data });
  },
  getThroughput: async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ThroughputQuery;

    const data = await reportsService.getThroughput(query);

    res.json({ success: true, data });
  },
};
