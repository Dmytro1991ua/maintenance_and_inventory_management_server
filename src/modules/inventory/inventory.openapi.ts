import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  CreateInventoryItemSchema,
  InventoryCategoriesResponseSchema,
  InventoryItemIdParamSchema,
  InventoryItemResponseSchema,
  InventoryListResponseSchema,
  InventoryQuerySchema,
  UpdateInventoryItemSchema,
} from "./inventory.schemas";

const bearerAuth = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/inventory/categories",
  description: "Return the complete list of valid inventory category values.",
  tags: ["Inventory"],
  security: bearerAuth,
  responses: {
    200: {
      description: "Array of category enum values",
      content: { "application/json": { schema: InventoryCategoriesResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/inventory",
  description:
    "List inventory items. Supports pagination, search, sorting, `lowStock=true` to filter items below their minimum stock level, and `category` to filter by item category.",
  tags: ["Inventory"],
  security: bearerAuth,
  request: { query: InventoryQuerySchema },
  responses: {
    200: {
      description: "Paginated list of inventory items",
      content: { "application/json": { schema: InventoryListResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/inventory/{id}",
  description: "Get a single inventory item by ID.",
  tags: ["Inventory"],
  security: bearerAuth,
  request: { params: InventoryItemIdParamSchema },
  responses: {
    200: {
      description: "Item found",
      content: { "application/json": { schema: InventoryItemResponseSchema } },
    },
    404: {
      description: "Item not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/inventory",
  description:
    "Create a new inventory item. Requires ADMIN or MANAGER role. Serial number must be unique.",
  tags: ["Inventory"],
  security: bearerAuth,
  request: {
    body: { content: { "application/json": { schema: CreateInventoryItemSchema } } },
  },
  responses: {
    201: {
      description: "Item created",
      content: { "application/json": { schema: InventoryItemResponseSchema } },
    },
    403: {
      description: "Insufficient permissions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Serial number already exists",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/inventory/{id}",
  description: "Update an inventory item. Requires ADMIN or MANAGER role.",
  tags: ["Inventory"],
  security: bearerAuth,
  request: {
    params: InventoryItemIdParamSchema,
    body: { content: { "application/json": { schema: UpdateInventoryItemSchema } } },
  },
  responses: {
    200: {
      description: "Item updated",
      content: { "application/json": { schema: InventoryItemResponseSchema } },
    },
    403: {
      description: "Insufficient permissions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Item not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/inventory/{id}",
  description: "Delete an inventory item. ADMIN only.",
  tags: ["Inventory"],
  security: bearerAuth,
  request: { params: InventoryItemIdParamSchema },
  responses: {
    204: { description: "Item deleted" },
    403: {
      description: "ADMIN role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Item not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
