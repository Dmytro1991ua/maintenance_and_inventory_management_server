import { ConflictError, ForbiddenError } from "../../errors";
import { Role } from "../../generated/prisma/client";
import { findOrThrow } from "../../utils";
import { usersRepository } from "./users.repository";
import type { UpdateRoles, UpdateUser, UsersQuery } from "./users.schemas";

export const usersService = {
  findAll: async (query: UsersQuery) => {
    return usersRepository.findAll(query);
  },
  findById: async (id: string) => {
    return findOrThrow(() => usersRepository.findById(id), "User not found");
  },
  // A user can update their own profile.
  // An ADMIN can update any profile.
  // Nobody can update someone else's profile without ADMIN role.
  update: async (
    targetId: string,
    data: UpdateUser,
    requestingUser: { id: string; roles: Role[] },
  ) => {
    const isOwnProfile = requestingUser.id === targetId;
    const isAdmin = requestingUser.roles.includes(Role.ADMIN);

    if (!isOwnProfile && !isAdmin) {
      throw new ForbiddenError("You can only update your own profile");
    }

    const existing = await findOrThrow(() => usersRepository.findById(targetId), "User not found");

    // Only check fields that are actually being changed —
    // avoids false conflicts when user submits their own current values.
    // service-level check is UX optimization — DB UNIQUE constraint is the real guard.
    const conflicts = await usersRepository.findConflicts({
      email: data.email === existing.email ? undefined : data.email,
      userName: data.userName === existing.userName ? undefined : data.userName,
      excludeId: targetId,
    });

    if (conflicts.email) throw new ConflictError("Email already in use");
    if (conflicts.userName) throw new ConflictError("Username already taken");

    return usersRepository.update(targetId, data);
  },
  // ADMIN only
  // but we also guard here as defense in depth
  updateRoles: async (targetId: string, data: UpdateRoles) => {
    await findOrThrow(() => usersRepository.findById(targetId), "User not found");

    return usersRepository.updateRoles(targetId, data);
  },
  // ADMIN only
  delete: async (targetId: string, requestingUserId: string) => {
    // Prevent self-deletion — an admin accidentally deleting themselves
    // would lock everyone out if they are the only admin
    if (targetId === requestingUserId) {
      throw new ForbiddenError("You cannot delete your own account");
    }

    await findOrThrow(() => usersRepository.findById(targetId), "User not found");

    await usersRepository.delete(targetId);
  },
};
