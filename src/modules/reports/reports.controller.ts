import { Request, Response } from "express";

import type { AssetReportQuery, ThroughputQuery } from "./reports.schemas";
import { reportsService } from "./reports.service";

/**
 * Reports controller — HTTP layer only.
 */
export const reportsController = {
  getAssetReliability: async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AssetReportQuery;

    const result = await reportsService.getAssetReliability(query);

    res.json({ success: true, ...result });
  },
  getThroughput: async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ThroughputQuery;

    const data = await reportsService.getThroughput(query);

    res.json({ success: true, data });
  },
};
