import { ErrorResponseSchema, registry } from "../../config/openapi";
import {
  InviteIdParamSchema,
  InviteResponseSchema,
  InviteUserSchema,
  PendingInvitesResponseSchema,
} from "./invites.schemas";
import {
  ChangePasswordSchema,
  NotificationPreferencesResponseSchema,
  NotificationPreferencesSchema,
  UpdateRolesSchema,
  UpdateUserSchema,
  UpdateUserStatusSchema,
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

registry.registerPath({
  method: "post",
  path: "/users/invite",
  description:
    "Send an invite email to a new user. ADMIN only. The recipient receives a link to set their username and password.",
  tags: ["Users"],
  security: bearerAuth,
  request: {
    body: { content: { "application/json": { schema: InviteUserSchema } } },
  },
  responses: {
    201: {
      description: "Invite created and email sent",
      content: { "application/json": { schema: InviteResponseSchema } },
    },
    403: {
      description: "ADMIN role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    409: {
      description: "Email already registered",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/users/pending-invites",
  description:
    "List invites that have been sent but not yet accepted. ADMIN only. Includes an `isExpired` flag for invites past their 48-hour window.",
  tags: ["Users"],
  security: bearerAuth,
  responses: {
    200: {
      description: "List of pending invites",
      content: { "application/json": { schema: PendingInvitesResponseSchema } },
    },
    403: {
      description: "ADMIN role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/users/invites/{id}",
  description:
    "Cancel a pending invite that has not yet been accepted. ADMIN only. Returns 400 if the invite was already accepted.",
  tags: ["Users"],
  security: bearerAuth,
  request: { params: InviteIdParamSchema },
  responses: {
    204: { description: "Invite cancelled" },
    400: {
      description: "Invite already accepted",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    403: {
      description: "ADMIN role required",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "Invite not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/users/me/sessions",
  description:
    "Sign out of all devices by revoking every active refresh token. The caller's current access token remains valid until it expires (≤15 min).",
  tags: ["Users"],
  security: bearerAuth,
  responses: {
    204: { description: "All sessions revoked" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/users/me",
  description:
    "Permanently delete the authenticated user's own account. All active sessions are revoked before deletion.",
  tags: ["Users"],
  security: bearerAuth,
  responses: {
    204: { description: "Account deleted" },
    404: {
      description: "User not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/users/me/password",
  description:
    "Change the authenticated user's password. Requires the current password for verification. Revokes all active sessions — the user must log in again on all devices.",
  tags: ["Users"],
  security: bearerAuth,
  request: {
    body: { content: { "application/json": { schema: ChangePasswordSchema } } },
  },
  responses: {
    204: { description: "Password changed — all sessions revoked" },
    400: {
      description: "Current password incorrect, or new password same as current",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/users/me/avatar",
  description:
    "Upload or replace the authenticated user's profile picture. Accepts multipart/form-data with an `avatar` field (JPEG, PNG, or WebP; max 5 MB).",
  tags: ["Users"],
  security: bearerAuth,
  responses: {
    200: {
      description: "Avatar uploaded — returns the updated user profile",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    400: {
      description: "No file provided, wrong format, or file too large",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/users/{id}/status",
  description:
    "Activate or deactivate a user account. ADMIN only. An admin cannot change their own status.",
  tags: ["Users"],
  security: bearerAuth,
  request: {
    params: UserIdParamSchema,
    body: { content: { "application/json": { schema: UpdateUserStatusSchema } } },
  },
  responses: {
    200: {
      description: "Status updated",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    403: {
      description: "ADMIN role required, or attempting to change own status",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
    404: {
      description: "User not found",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/users/me/notification-preferences",
  description:
    "Get the authenticated user's notification preferences. Missing keys default to enabled — a fresh account with no saved preferences receives all notification types.",
  tags: ["Users"],
  security: bearerAuth,
  responses: {
    200: {
      description: "Current preferences",
      content: { "application/json": { schema: NotificationPreferencesResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/users/me/notification-preferences",
  description:
    "Partially update notification preferences. Only the keys you send are changed — omitted keys stay as they are. Set a type to false to stop receiving those notifications.",
  tags: ["Users"],
  security: bearerAuth,
  request: {
    body: { content: { "application/json": { schema: NotificationPreferencesSchema } } },
  },
  responses: {
    200: {
      description: "Updated preferences",
      content: { "application/json": { schema: NotificationPreferencesResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ErrorResponseSchema } },
    },
  },
});
