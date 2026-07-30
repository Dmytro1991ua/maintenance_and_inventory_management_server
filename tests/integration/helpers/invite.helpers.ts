import { Role } from "../../../src/generated/prisma/client";
import { prisma } from "../../../src/config";

export const createTestInvite = async (options: {
  email?: string;
  role?: Role;
  token?: string;
  expiresAt?: Date;
  usedAt?: Date | null;
  createdAt?: Date;
} = {}) => {
  const expiresAt = options.expiresAt ?? new Date(Date.now() + 48 * 60 * 60 * 1000);

  return prisma.userInvite.create({
    data: {
      email: options.email ?? "jane@example.com",
      role: options.role ?? Role.TECHNICIAN,
      token: options.token ?? crypto.randomUUID(),
      expiresAt,
      usedAt: options.usedAt ?? null,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    },
  });
};
