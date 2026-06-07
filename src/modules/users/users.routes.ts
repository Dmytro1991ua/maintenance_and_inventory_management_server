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
import { usersController } from "./users.controller";
import {
  UpdateRolesSchema,
  UpdateUserSchema,
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

export default router;
