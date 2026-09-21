import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  CreateReorderSchema,
  ReorderIdParamSchema,
  ReorderResponseSchema,
  ReordersListResponseSchema,
  ReordersQuerySchema,
} from "./reorders.schemas";

const bearerAuth = [{ bearerAuth: [] }];

const forbidden = {
  description: "ADMIN or MANAGER role required",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

const notFound = {
  description: "Reorder not found",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

registry.registerPath({
  method: "get",
  path: "/reorders",
  description:
    "List reorders. ADMIN/MANAGER only. Paginated; filter by `status` and `inventoryItemId`.",
  tags: ["Reorders"],
  security: bearerAuth,
  request: { query: ReordersQuerySchema },
  responses: {
    200: {
      description: "Paginated list of reorders",
      content: { "application/json": { schema: ReordersListResponseSchema } },
    },
    403: forbidden,
  },
});

registry.registerPath({
  method: "post",
  path: "/reorders",
  description:
    "Manually raise a reorder for an inventory item (status PENDING). ADMIN/MANAGER only. Rejected if the item already has an open (PENDING/ORDERED) reorder.",
  tags: ["Reorders"],
  security: bearerAuth,
  request: {
    body: { content: { "application/json": { schema: CreateReorderSchema } } },
  },
  responses: {
    201: {
      description: "Reorder raised",
      content: { "application/json": { schema: ReorderResponseSchema } },
    },
    403: forbidden,
    404: {
      description: "Inventory item not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Item already has an open reorder",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/reorders/{id}/order",
  description: "Mark a PENDING reorder as ORDERED. ADMIN/MANAGER only.",
  tags: ["Reorders"],
  security: bearerAuth,
  request: { params: ReorderIdParamSchema },
  responses: {
    200: {
      description: "Reorder marked ordered",
      content: { "application/json": { schema: ReorderResponseSchema } },
    },
    403: forbidden,
    404: notFound,
    409: {
      description: "Reorder is not pending",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/reorders/{id}/receive",
  description:
    "Mark an ORDERED reorder as RECEIVED and increment the item's stock by the reorder quantity. ADMIN/MANAGER only.",
  tags: ["Reorders"],
  security: bearerAuth,
  request: { params: ReorderIdParamSchema },
  responses: {
    200: {
      description: "Reorder received; stock incremented",
      content: { "application/json": { schema: ReorderResponseSchema } },
    },
    403: forbidden,
    404: notFound,
    409: {
      description: "Reorder has not been ordered",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/reorders/{id}/cancel",
  description: "Cancel an open (PENDING or ORDERED) reorder. ADMIN/MANAGER only.",
  tags: ["Reorders"],
  security: bearerAuth,
  request: { params: ReorderIdParamSchema },
  responses: {
    200: {
      description: "Reorder cancelled",
      content: { "application/json": { schema: ReorderResponseSchema } },
    },
    403: forbidden,
    404: notFound,
    409: {
      description: "Reorder is already received or cancelled",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
