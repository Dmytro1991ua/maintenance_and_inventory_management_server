import { Request, Response } from "express";

import type {
  CreateInventoryItem,
  InventoryItemIdParam,
  InventoryQuery,
  RestockInventoryItem,
  UpdateInventoryItem,
} from "./inventory.schemas";
import { inventoryService } from "./inventory.service";

/**
 * Inventory controller — HTTP layer only.
 */
export const inventoryController = {
  getCategories: (_req: Request, res: Response): void => {
    res.json({ success: true, data: inventoryService.getCategories() });
  },

  findAll: async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as InventoryQuery;

    const result = await inventoryService.findAll(query);

    res.json({ success: true, ...result });
  },
  findById: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as InventoryItemIdParam;

    const item = await inventoryService.findById(id);

    res.json({ success: true, data: item });
  },
  create: async (req: Request, res: Response): Promise<void> => {
    const data = req.body as CreateInventoryItem;
    const item = await inventoryService.create(data);

    res.status(201).json({ success: true, data: item });
  },
  update: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as InventoryItemIdParam;

    const data = req.body as UpdateInventoryItem;

    const item = await inventoryService.update(id, data);

    res.json({ success: true, data: item });
  },
  restock: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as InventoryItemIdParam;

    const data = req.body as RestockInventoryItem;

    const item = await inventoryService.restock(id, data);

    res.json({ success: true, data: item });
  },
  delete: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as InventoryItemIdParam;

    await inventoryService.delete(id);

    res.status(204).send();
  },
};
