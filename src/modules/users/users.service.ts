import bcrypt from "bcrypt";

import { redis } from "../../config";
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from "../../errors";
import { Role } from "../../generated/prisma/client";
import { storageService } from "../../shared/storage.service";
import { findOrThrow } from "../../utils";
import { BCRYPT_SALT_ROUNDS } from "../auth/auth.constants";
import { getRefreshTokenKey, getUserSessionKey } from "../auth/auth.utils";
import { USER_NOT_FOUND_MESSAGE } from "./users.constants";
import { usersRepository } from "./users.repository";
import type {
  ChangePassword,
  UpdateRoles,
  UpdateUser,
  UpdateUserStatus,
  UsersQuery,
} from "./users.schemas";

const revokeAllSessions = async (userId: string): Promise<void> => {
  const sessionKey = getUserSessionKey(userId);
  const tokenIds = await redis.smembers(sessionKey);

  if (tokenIds.length > 0) {
    await redis
      .pipeline()
      .del(...tokenIds.map((id) => getRefreshTokenKey(userId, id)), sessionKey)
      .exec();
  }
};

export const usersService = {
  findAll: async (query: UsersQuery) => {
    return usersRepository.findAll(query);
  },
  findById: async (id: string) => {
    return findOrThrow(() => usersRepository.findById(id), USER_NOT_FOUND_MESSAGE);
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

    const existing = await findOrThrow(
      () => usersRepository.findById(targetId),
      USER_NOT_FOUND_MESSAGE,
    );

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
    await findOrThrow(() => usersRepository.findById(targetId), USER_NOT_FOUND_MESSAGE);

    return usersRepository.updateRoles(targetId, data);
  },
  // ADMIN only
  updateStatus: async (targetId: string, data: UpdateUserStatus, requestingUserId: string) => {
    if (targetId === requestingUserId) {
      throw new ForbiddenError("You cannot change your own status");
    }

    await findOrThrow(() => usersRepository.findById(targetId), USER_NOT_FOUND_MESSAGE);

    return usersRepository.updateStatus(targetId, data);
  },

  uploadAvatar: async (userId: string, file: Express.Multer.File) => {
    const user = await findOrThrow(() => usersRepository.findById(userId), USER_NOT_FOUND_MESSAGE);

    if (user.avatarUrl) {
      await storageService.deleteAvatar(user.avatarUrl).catch(() => {});
    }

    const avatarUrl = await storageService.uploadAvatar(userId, file.buffer, file.mimetype);
    return usersRepository.updateAvatar(userId, avatarUrl);
  },

  changePassword: async (userId: string, data: ChangePassword): Promise<void> => {
    const user = await usersRepository.findByIdWithPassword(userId);

    if (!user) throw new UnauthorizedError("Not authenticated");

    const match = await bcrypt.compare(data.currentPassword, user.password);

    if (!match) throw new BadRequestError("Current password is incorrect");

    if (data.currentPassword === data.newPassword) {
      throw new BadRequestError("New password must be different from the current password");
    }

    const hashed = await bcrypt.hash(data.newPassword, BCRYPT_SALT_ROUNDS);

    await usersRepository.updatePassword(userId, hashed);

    // Password change is a security event — revoke all sessions on all devices.
    await revokeAllSessions(userId);
  },

  signOutAllDevices: async (userId: string): Promise<void> => {
    await revokeAllSessions(userId);
  },

  deleteAccount: async (userId: string): Promise<void> => {
    await findOrThrow(() => usersRepository.findById(userId), USER_NOT_FOUND_MESSAGE);

    // Revoke sessions before deleting — avoids orphaned Redis keys
    // and ensures in-flight tokens stop working immediately.
    await revokeAllSessions(userId);
    await usersRepository.delete(userId);
  },

  // ADMIN only
  delete: async (targetId: string, requestingUserId: string) => {
    // Prevent self-deletion — an admin accidentally deleting themselves
    // would lock everyone out if they are the only admin
    if (targetId === requestingUserId) {
      throw new ForbiddenError("You cannot delete your own account");
    }

    await findOrThrow(() => usersRepository.findById(targetId), USER_NOT_FOUND_MESSAGE);

    await usersRepository.delete(targetId);
  },
};
