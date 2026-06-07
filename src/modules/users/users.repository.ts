import { prisma } from "../../config";
import { Prisma } from "../../generated/prisma/client";
import { getTotalPages } from "../../utils";
import { USER_SELECT } from "./users.constants";
import type { UpdateRoles, UpdateUser, UsersQuery } from "./users.schemas";
import { resolveSortField } from "./users.utils";

export const usersRepository = {
  findAll: async (query: UsersQuery) => {
    const { page, limit, role, sortBy, sortOrder } = query;

    const where: Prisma.UserWhereInput = {
      ...(role ? { roles: { has: role } } : {}),
    };

    const field = resolveSortField(sortBy);

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { [field]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        pages: getTotalPages(total, limit),
      },
    };
  },

  findById: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    }),

  // Single DB call instead of two sequential findUnique calls.
  // excludeId prevents false positives when the user updates their own fields.
  //
  // Note: service-level conflict checks are UX optimization only.
  // The real enforcement is the UNIQUE constraint in the DB schema —
  // that prevents race conditions where two requests pass the check simultaneously.
  findConflicts: async ({
    email,
    userName,
    excludeId,
  }: {
    email?: string;
    userName?: string;
    excludeId?: string;
  }) => {
    const [emailConflict, userNameConflict] = await Promise.all([
      email
        ? prisma.user.findFirst({
            where: { email, NOT: excludeId ? { id: excludeId } : undefined },
            select: { id: true },
          })
        : null,

      userName
        ? prisma.user.findFirst({
            where: { userName, NOT: excludeId ? { id: excludeId } : undefined },
            select: { id: true },
          })
        : null,
    ]);

    return {
      email: !!emailConflict,
      userName: !!userNameConflict,
    };
  },

  update: (id: string, data: UpdateUser) =>
    prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    }),

  updateRoles: (id: string, data: UpdateRoles) =>
    prisma.user.update({
      where: { id },
      data: { roles: data.roles },
      select: USER_SELECT,
    }),

  delete: (id: string) => prisma.user.delete({ where: { id } }),
};
