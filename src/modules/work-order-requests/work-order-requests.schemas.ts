import { z } from "zod";

import { TaskCategoryEnum } from "../tasks/tasks.schemas";
import { WORK_ORDER_REQUEST_STATUSES } from "./work-order-requests.constants";

export { WORK_ORDER_REQUEST_STATUSES };

export const WorkOrderRequestStatusEnum = z.enum(WORK_ORDER_REQUEST_STATUSES);
const PriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const WorkOrderRequestsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
    search: z.string().optional().openapi({ example: "leak" }),
    status: WorkOrderRequestStatusEnum.optional(),
    sortBy: z.enum(["createdAt", "priority", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .openapi("WorkOrderRequestsQuery");

export const CreateWorkOrderRequestSchema = z
  .object({
    title: z
      .string()
      .min(1, { error: "Title is required" })
      .max(200)
      .openapi({ example: "AC in Room 204 is leaking" }),
    description: z
      .string()
      .max(2000)
      .optional()
      .openapi({ example: "Water pooling under the unit since this morning." }),
    category: TaskCategoryEnum.optional().openapi({ example: "HVAC" }),
    priority: PriorityEnum.default("MEDIUM").openapi({ example: "HIGH" }),
    assetId: z.uuid({ error: "Invalid asset ID" }).optional(),
  })
  .strict()
  .openapi("CreateWorkOrderRequestInput");

export const ApproveWorkOrderRequestSchema = z
  .object({
    assignedTo: z.uuid({ error: "Invalid user ID" }).optional(),
    dueDate: z.coerce.date().optional().openapi({ example: "2026-09-15T00:00:00.000Z" }),
  })
  .strict()
  .openapi("ApproveWorkOrderRequestInput");

export const RejectWorkOrderRequestSchema = z
  .object({
    reason: z
      .string()
      .min(1, { error: "Rejection reason is required" })
      .max(500)
      .openapi({ example: "Duplicate of an existing scheduled task." }),
  })
  .strict()
  .openapi("RejectWorkOrderRequestInput");

export const WorkOrderRequestIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid work order request ID" }),
});

// — Response schemas — documentation only ——————————————————————————————————

export const WorkOrderRequestSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    category: TaskCategoryEnum.nullable(),
    priority: PriorityEnum,
    status: WorkOrderRequestStatusEnum,
    assetId: z.uuid().nullable(),
    requestedBy: z.uuid(),
    reviewedBy: z.uuid().nullable(),
    reviewedAt: z.iso.datetime().nullable(),
    rejectionReason: z.string().nullable(),
    taskId: z.uuid().nullable(),
    requester: z.object({ id: z.uuid(), userName: z.string(), email: z.string() }),
    reviewer: z.object({ id: z.uuid(), userName: z.string(), email: z.string() }).nullable(),
    asset: z.object({ id: z.uuid(), name: z.string(), serialNumber: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("WorkOrderRequest");

export const WorkOrderRequestResponseSchema = z
  .object({
    success: z.literal(true),
    data: WorkOrderRequestSchema,
  })
  .openapi("WorkOrderRequestResponse");

export const WorkOrderRequestsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(WorkOrderRequestSchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  })
  .openapi("WorkOrderRequestsListResponse");

export type WorkOrderRequestsQuery = z.infer<typeof WorkOrderRequestsQuerySchema>;
export type CreateWorkOrderRequest = z.infer<typeof CreateWorkOrderRequestSchema>;
export type ApproveWorkOrderRequest = z.infer<typeof ApproveWorkOrderRequestSchema>;
export type RejectWorkOrderRequest = z.infer<typeof RejectWorkOrderRequestSchema>;
export type WorkOrderRequestIdParam = z.infer<typeof WorkOrderRequestIdParamSchema>;
