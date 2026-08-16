import { NotFoundError } from "../../errors";
import { InventoryCategory } from "../../generated/prisma/client";
import { checklistTemplatesRepository } from "./checklist-templates.repository";
import type { UpdateChecklistTemplate } from "./checklist-templates.schemas";

export const checklistTemplatesService = {
  findAll: async () => checklistTemplatesRepository.findAll(),
  findByCategory: async (category: InventoryCategory) => {
    const template = await checklistTemplatesRepository.findByCategory(category);

    if (!template) {
      throw new NotFoundError(`No checklist template found for category ${category}`);
    }

    return template;
  },
  updateByCategory: async (category: InventoryCategory, data: UpdateChecklistTemplate) =>
    checklistTemplatesRepository.updateByCategory(category, data.items),
};
