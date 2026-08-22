import { Request, Response } from "express";

import { UnauthorizedError } from "../../errors";
import { dashboardService } from "./dashboard.service";

export const dashboardController = {
  getStats: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const data = await dashboardService.getStats({
      id: req.user.id,
      roles: req.user.roles,
    });

    res.json({ success: true, data });
  },
};
