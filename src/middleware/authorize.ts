import { NextFunction, Request, Response } from "express";

import { ForbiddenError } from "../errors";
import { Role } from "../generated/prisma/client";

/**
 * RBAC middleware — restricts access to users with specific roles.
 * Must always be used AFTER authenticate — requires req.user to be set.
 *
 * Usage:
 *   router.delete("/users/:id", authenticate, authorize([Role.ADMIN]), ...)
 *   router.patch("/tasks/:id",  authenticate, authorize([Role.ADMIN, Role.MANAGER]), ...)
 */
export const authorize =
  (allowedRoles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    // authenticate must run first — if req.user is missing, it's a setup error
    if (!req.user) {
      throw new ForbiddenError("Access denied");
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenError("Insufficient permissions");
    }

    next();
  };
