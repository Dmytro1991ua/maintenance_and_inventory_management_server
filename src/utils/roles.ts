import { Role } from "../generated/prisma/client";

/**
 * True when the user holds an elevated role (ADMIN or MANAGER).
 * Used for in-service authorization decisions that depend on ownership as well
 * as role — where route-level `authorize()` middleware isn't enough on its own.
 */
export const isAdminOrManager = (roles: Role[]): boolean =>
  roles.some((role) => role === Role.ADMIN || role === Role.MANAGER);
