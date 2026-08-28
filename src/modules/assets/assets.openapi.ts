import { ErrorResponseSchema, registry } from "../../config/openapi";
import { TasksListResponseSchema, TasksQuerySchema } from "../tasks/tasks.schemas";
import {
  AssetCategoriesResponseSchema,
  AssetIdParamSchema,
  AssetListResponseSchema,
  AssetResponseSchema,
  AssetsQuerySchema,
  AssetStatsResponseSchema,
  CreateAssetSchema,
  UpdateAssetSchema,
} from "./assets.schemas";

const bearerAuth = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/assets/categories",
  description: "Return the complete list of valid asset category values.",
  tags: ["Assets"],
  security: bearerAuth,
  responses: {
    200: {
      description: "Array of category enum values",
      content: { "application/json": { schema: AssetCategoriesResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/assets/stats",
  description:
    "Aggregate asset counts grouped by category. Returns totals for operational, down, and retired across all categories and per category.",
  tags: ["Assets"],
  security: bearerAuth,
  responses: {
    200: {
      description: "Asset stats",
      content: { "application/json": { schema: AssetStatsResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/assets",
  description:
    "List assets. Supports pagination, search, sorting, `category` filter, and `status` filter (`OPERATIONAL`, `DOWN`, `RETIRED`).",
  tags: ["Assets"],
  security: bearerAuth,
  request: { query: AssetsQuerySchema },
  responses: {
    200: {
      description: "Paginated list of assets",
      content: { "application/json": { schema: AssetListResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/assets/{id}/tasks",
  description:
    "Maintenance history for one asset — every task recorded against it. Supports the same pagination, sorting, and filters as the tasks list.",
  tags: ["Assets"],
  security: bearerAuth,
  request: { params: AssetIdParamSchema, query: TasksQuerySchema },
  responses: {
    200: {
      description: "Paginated list of the asset's tasks",
      content: { "application/json": { schema: TasksListResponseSchema } },
    },
    404: {
      description: "Asset not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/assets/{id}",
  description: "Get a single asset by ID.",
  tags: ["Assets"],
  security: bearerAuth,
  request: { params: AssetIdParamSchema },
  responses: {
    200: {
      description: "Asset found",
      content: { "application/json": { schema: AssetResponseSchema } },
    },
    404: {
      description: "Asset not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/assets",
  description:
    "Register a new asset. Requires ADMIN or MANAGER role. Serial number must be unique.",
  tags: ["Assets"],
  security: bearerAuth,
  request: {
    body: { content: { "application/json": { schema: CreateAssetSchema } } },
  },
  responses: {
    201: {
      description: "Asset created",
      content: { "application/json": { schema: AssetResponseSchema } },
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
  path: "/assets/{id}",
  description: "Update an asset. Requires ADMIN or MANAGER role. Serial number is not updatable.",
  tags: ["Assets"],
  security: bearerAuth,
  request: {
    params: AssetIdParamSchema,
    body: { content: { "application/json": { schema: UpdateAssetSchema } } },
  },
  responses: {
    200: {
      description: "Asset updated",
      content: { "application/json": { schema: AssetResponseSchema } },
    },
    403: {
      description: "Insufficient permissions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Asset not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/assets/{id}",
  description:
    "Delete an asset. ADMIN only. Tasks recorded against it are preserved; their asset link is cleared.",
  tags: ["Assets"],
  security: bearerAuth,
  request: { params: AssetIdParamSchema },
  responses: {
    204: { description: "Asset deleted" },
    403: {
      description: "ADMIN role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Asset not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
