import { Request, Response } from "express";

import { UnauthorizedError } from "../../errors";
import type {
  CreateReorder,
  ReceiveReorder,
  ReorderIdParam,
  ReordersQuery,
} from "./reorders.schemas";
import { reordersService } from "./reorders.service";

export const reordersController = {
  findAll: async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as ReordersQuery;

    const result = await reordersService.findAll(query);

    res.json({ success: true, ...result });
  },
  getStats: async (_req: Request, res: Response): Promise<void> => {
    const data = await reordersService.getStats();

    res.json({ success: true, data });
  },
  create: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { inventoryItemId } = req.body as CreateReorder;

    const reorder = await reordersService.raise(inventoryItemId, req.user.id);

    res.status(201).json({ success: true, data: reorder });
  },
  markOrdered: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id } = req.params as ReorderIdParam;

    const reorder = await reordersService.markOrdered(id, req.user.id);

    res.json({ success: true, data: reorder });
  },
  receive: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id } = req.params as ReorderIdParam;
    const { receivedUnitCost } = req.body as ReceiveReorder;

    const reorder = await reordersService.receive(id, req.user.id, receivedUnitCost ?? null);

    res.json({ success: true, data: reorder });
  },
  cancel: async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");

    const { id } = req.params as ReorderIdParam;

    const reorder = await reordersService.cancel(id, req.user.id);

    res.json({ success: true, data: reorder });
  },
};
