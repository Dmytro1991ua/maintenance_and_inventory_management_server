import { Prisma } from "../../generated/prisma/client";

export const WORK_ORDER_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const WORK_ORDER_REQUEST_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  assetId: true,
  requestedBy: true,
  reviewedBy: true,
  reviewedAt: true,
  rejectionReason: true,
  taskId: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, userName: true, email: true } },
  reviewer: { select: { id: true, userName: true, email: true } },
  asset: { select: { id: true, name: true, serialNumber: true } },
} satisfies Prisma.WorkOrderRequestSelect;

export const WORK_ORDER_REQUEST_ENTITY_ALLOWED_SORT_FIELDS = [
  "createdAt",
  "priority",
  "status",
] as const;

export const WORK_ORDER_REQUEST_ENTITY_DEFAULT_SORT_FIELD = "createdAt" as const;

export const WORK_ORDER_REQUEST_NOT_FOUND_MESSAGE = "Work order request not found";

export const ALREADY_REVIEWED_MESSAGE = "Request has already been reviewed";
