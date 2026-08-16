import { Request, Response } from "express";

import { InventoryCategory } from "../../generated/prisma/client";
import type {
  ChecklistCategoryParam,
  UpdateChecklistTemplate,
} from "./checklist-templates.schemas";
import { checklistTemplatesService } from "./checklist-templates.service";

export const checklistTemplatesController = {
  findAll: async (_req: Request, res: Response): Promise<void> => {
    const templates = await checklistTemplatesService.findAll();

    res.json({ success: true, data: templates });
  },
  findByCategory: async (req: Request, res: Response): Promise<void> => {
    const { category } = req.params as ChecklistCategoryParam;

    const template = await checklistTemplatesService.findByCategory(category as InventoryCategory);

    res.json({ success: true, data: template });
  },
  updateByCategory: async (req: Request, res: Response): Promise<void> => {
    const { category } = req.params as ChecklistCategoryParam;
    const data = req.body as UpdateChecklistTemplate;

    const template = await checklistTemplatesService.updateByCategory(
      category as InventoryCategory,
      data,
    );

    res.json({ success: true, data: template });
  },
};
