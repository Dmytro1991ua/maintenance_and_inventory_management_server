import { prisma } from "../../config";
import { InventoryCategory, Prisma } from "../../generated/prisma/client";

const CHECKLIST_TEMPLATE_SELECT = {
  id: true,
  category: true,
  items: true,
  updatedAt: true,
} satisfies Prisma.ChecklistTemplateSelect;

export const checklistTemplatesRepository = {
  findAll: async () =>
    prisma.checklistTemplate.findMany({
      select: CHECKLIST_TEMPLATE_SELECT,
      orderBy: { category: "asc" },
    }),
  findByCategory: async (category: InventoryCategory) =>
    prisma.checklistTemplate.findUnique({
      where: { category },
      select: CHECKLIST_TEMPLATE_SELECT,
    }),
  updateByCategory: async (category: InventoryCategory, items: string[]) =>
    prisma.checklistTemplate.upsert({
      where: { category },
      update: { items },
      create: { category, items },
      select: CHECKLIST_TEMPLATE_SELECT,
    }),
};
