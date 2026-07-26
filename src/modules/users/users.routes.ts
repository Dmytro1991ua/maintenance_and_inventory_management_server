import { Router } from "express";

import { Role } from "../../generated/prisma/client";
import {
  asyncHandler,
  authenticate,
  authorize,
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware";
import { InviteIdParamSchema, InviteUserSchema } from "./invites.schemas";
import { usersController } from "./users.controller";
import {
  UpdateRolesSchema,
  UpdateUserSchema,
  UpdateUserStatusSchema,
  UserIdParamSchema,
  UsersQuerySchema,
} from "./users.schemas";

const router = Router();

/**
 * GET /api/v1/users
 * ADMIN + MANAGER only
 */
router.get(
  "/",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateQuery(UsersQuerySchema),
  asyncHandler(usersController.findAll),
);

/**
 * GET /api/v1/users/me
 * Any authenticated user — returns their own profile
 * Must be defined BEFORE /:id to prevent "me" being treated as a param
 */
router.get("/me", authenticate, asyncHandler(usersController.getMe));

/**
 * GET /api/v1/users/pending-invites
 * ADMIN only — list invites that have not been accepted yet
 * Must be defined BEFORE /:id to prevent "pending-invites" being treated as a param
 */
router.get(
  "/pending-invites",
  authenticate,
  authorize([Role.ADMIN]),
  asyncHandler(usersController.getPendingInvites),
);

/**
 * GET /api/v1/users/:id
 * ADMIN + MANAGER only — get any user by ID
 */
router.get(
  "/:id",
  authenticate,
  authorize([Role.ADMIN, Role.MANAGER]),
  validateParams(UserIdParamSchema),
  asyncHandler(usersController.findById),
);

/**
 * PATCH /api/v1/users/:id
 * ADMIN or own profile — update userName or email
 * Authorization logic (own vs admin) is enforced in the service layer
 */
router.patch(
  "/:id",
  authenticate,
  validateParams(UserIdParamSchema),
  validateBody(UpdateUserSchema),
  asyncHandler(usersController.update),
);

/**
 * PATCH /api/v1/users/:id/roles
 * ADMIN only — assign roles to a user
 */
router.patch(
  "/:id/roles",
  authenticate,
  authorize([Role.ADMIN]),
  validateParams(UserIdParamSchema),
  validateBody(UpdateRolesSchema),
  asyncHandler(usersController.updateRoles),
);

/**
 * DELETE /api/v1/users/:id
 * ADMIN only — delete a user
 */
router.delete(
  "/:id",
  authenticate,
  authorize([Role.ADMIN]),
  validateParams(UserIdParamSchema),
  asyncHandler(usersController.delete),
);

/**
 * POST /api/v1/users/invite
 * ADMIN only — create an invite token and send email to the recipient
 */
router.post(
  "/invite",
  authenticate,
  authorize([Role.ADMIN]),
  validateBody(InviteUserSchema),
  asyncHandler(usersController.inviteUser),
);

/**
 * DELETE /api/v1/users/invites/:id
 * ADMIN only — cancel a pending invite that has not been accepted yet
 * Must be defined BEFORE /:id routes to avoid param conflicts
 */
router.delete(
  "/invites/:id",
  authenticate,
  authorize([Role.ADMIN]),
  validateParams(InviteIdParamSchema),
  asyncHandler(usersController.cancelInvite),
);

/**
 * PATCH /api/v1/users/:id/status
 * ADMIN only — activate or deactivate a user
 */
router.patch(
  "/:id/status",
  authenticate,
  authorize([Role.ADMIN]),
  validateParams(UserIdParamSchema),
  validateBody(UpdateUserStatusSchema),
  asyncHandler(usersController.updateStatus),
);

export default router;
