import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  ApproveWorkOrderRequestSchema,
  CreateWorkOrderRequestSchema,
  RejectWorkOrderRequestSchema,
  WorkOrderRequestIdParamSchema,
  WorkOrderRequestResponseSchema,
  WorkOrderRequestsListResponseSchema,
  WorkOrderRequestsQuerySchema,
} from "./work-order-requests.schemas";

const bearerAuth = [{ bearerAuth: [] }];

registry.registerPath({
  method: "post",
  path: "/work-order-requests",
  description:
    "File a maintenance request (status PENDING). Any authenticated user may submit one.",
  tags: ["Work Order Requests"],
  security: bearerAuth,
  request: {
    body: { content: { "application/json": { schema: CreateWorkOrderRequestSchema } } },
  },
  responses: {
    201: {
      description: "Request created",
      content: { "application/json": { schema: WorkOrderRequestResponseSchema } },
    },
    404: {
      description: "Referenced asset not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/work-order-requests",
  description:
    "List requests. ADMIN/MANAGER see the full triage queue; other users see only their own. Paginated; filter by `status`; search title/description.",
  tags: ["Work Order Requests"],
  security: bearerAuth,
  request: { query: WorkOrderRequestsQuerySchema },
  responses: {
    200: {
      description: "Paginated list of requests",
      content: { "application/json": { schema: WorkOrderRequestsListResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/work-order-requests/{id}",
  description: "Get a single request. Accessible to its requester or any ADMIN/MANAGER.",
  tags: ["Work Order Requests"],
  security: bearerAuth,
  request: { params: WorkOrderRequestIdParamSchema },
  responses: {
    200: {
      description: "Request found",
      content: { "application/json": { schema: WorkOrderRequestResponseSchema } },
    },
    403: {
      description: "Not your request",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Request not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/work-order-requests/{id}/approve",
  description:
    "Approve a PENDING request. ADMIN/MANAGER only. Creates a task from the request (optionally assigning it and setting a due date) and links it back. Rejected if the request was already reviewed.",
  tags: ["Work Order Requests"],
  security: bearerAuth,
  request: {
    params: WorkOrderRequestIdParamSchema,
    body: { content: { "application/json": { schema: ApproveWorkOrderRequestSchema } } },
  },
  responses: {
    200: {
      description: "Request approved; task created",
      content: { "application/json": { schema: WorkOrderRequestResponseSchema } },
    },
    403: {
      description: "ADMIN or MANAGER role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Request or assignee/asset not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Request has already been reviewed",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/work-order-requests/{id}/reject",
  description:
    "Reject a PENDING request with a required reason. ADMIN/MANAGER only. Rejected if the request was already reviewed.",
  tags: ["Work Order Requests"],
  security: bearerAuth,
  request: {
    params: WorkOrderRequestIdParamSchema,
    body: { content: { "application/json": { schema: RejectWorkOrderRequestSchema } } },
  },
  responses: {
    200: {
      description: "Request rejected",
      content: { "application/json": { schema: WorkOrderRequestResponseSchema } },
    },
    403: {
      description: "ADMIN or MANAGER role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Request not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Request has already been reviewed",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
