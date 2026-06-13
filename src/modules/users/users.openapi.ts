import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  UpdateRolesSchema,
  UpdateUserSchema,
  UserIdParamSchema,
  UserResponseSchema,
  UsersListResponseSchema,
  UsersQuerySchema,
} from "./users.schemas";

const bearerAuth = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/users",
  description: "List all users. Requires ADMIN or MANAGER role.",
  tags: ["Users"],
  security: bearerAuth,
  request: { query: UsersQuerySchema },
  responses: {
    200: {
      description: "Paginated list of users",
      content: { "application/json": { schema: UsersListResponseSchema } },
    },
    403: {
      description: "Insufficient permissions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/users/me",
  description: "Get the currently authenticated user's profile.",
  tags: ["Users"],
  security: bearerAuth,
  responses: {
    200: {
      description: "Own profile",
      content: { "application/json": { schema: UserResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/users/{id}",
  description: "Get a single user by ID. Requires ADMIN or MANAGER role.",
  tags: ["Users"],
  security: bearerAuth,
  request: { params: UserIdParamSchema },
  responses: {
    200: {
      description: "User found",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    403: {
      description: "Insufficient permissions",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "User not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/users/{id}",
  description:
    "Update a user's profile. A user may update their own profile; ADMINs may update any profile.",
  tags: ["Users"],
  security: bearerAuth,
  request: {
    params: UserIdParamSchema,
    body: { content: { "application/json": { schema: UpdateUserSchema } } },
  },
  responses: {
    200: {
      description: "User updated",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    403: {
      description: "Not your profile and not an admin",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "User not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Email or username already in use",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/users/{id}/roles",
  description: "Assign roles to a user. ADMIN only.",
  tags: ["Users"],
  security: bearerAuth,
  request: {
    params: UserIdParamSchema,
    body: { content: { "application/json": { schema: UpdateRolesSchema } } },
  },
  responses: {
    200: {
      description: "Roles updated",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    403: {
      description: "ADMIN role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "User not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/users/{id}",
  description: "Delete a user. ADMIN only. An admin cannot delete their own account.",
  tags: ["Users"],
  security: bearerAuth,
  request: { params: UserIdParamSchema },
  responses: {
    204: { description: "User deleted" },
    403: {
      description: "ADMIN role required, or attempting to delete own account",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "User not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
