import { prisma } from "../../../src/config";
import type {
  InventoryCategory,
  TaskPriority,
  WorkOrderRequest,
  WorkOrderRequestStatus,
} from "../../../src/generated/prisma/client";

type CreateTestWorkOrderRequestOptions = {
  requestedBy: string;
  title?: string;
  description?: string | null;
  category?: InventoryCategory | null;
  priority?: TaskPriority;
  status?: WorkOrderRequestStatus;
  assetId?: string | null;
};

export const createTestWorkOrderRequest = (
  options: CreateTestWorkOrderRequestOptions,
): Promise<WorkOrderRequest> =>
  prisma.workOrderRequest.create({
    data: {
      title: options.title ?? "AC in Room 204 is leaking",
      description: options.description ?? null,
      category: options.category ?? null,
      priority: options.priority ?? "MEDIUM",
      status: options.status ?? "PENDING",
      assetId: options.assetId ?? null,
      requestedBy: options.requestedBy,
    },
  });
