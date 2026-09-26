import { Prisma } from "../../generated/prisma/client";

export const REORDER_STATUSES = ["PENDING", "ORDERED", "RECEIVED", "CANCELLED"] as const;

export const REORDER_SELECT = {
  id: true,
  inventoryItemId: true,
  status: true,
  quantity: true,
  raisedBy: true,
  reviewedBy: true,
  createdAt: true,
  updatedAt: true,
  inventoryItem: {
    select: {
      id: true,
      name: true,
      serialNumber: true,
      quantity: true,
      minStockLevel: true,
      reorderPoint: true,
      supplier: true,
    },
  },
} satisfies Prisma.ReorderSelect;

export const REORDER_ENTITY_ALLOWED_SORT_FIELDS = ["createdAt", "status"] as const;

export const REORDER_ENTITY_DEFAULT_SORT_FIELD = "createdAt" as const;

export const REORDER_NOT_FOUND_MESSAGE = "Reorder not found";

export const OPEN_REORDER_EXISTS_MESSAGE = "An open reorder already exists for this item";

export const NOT_PENDING_MESSAGE = "Reorder is not pending";

export const NOT_ORDERED_MESSAGE = "Reorder has not been ordered";

export const NOT_OPEN_MESSAGE = "Reorder is already received or cancelled";
