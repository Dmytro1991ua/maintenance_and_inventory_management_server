import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

import { prisma } from "../../../src/config";
import { Role, type User } from "../../../src/generated/prisma/client";

// Cost factor kept low (vs. BCRYPT_SALT_ROUNDS=12 in production) — tests
// create many users and don't need brute-force resistance, only a real
// bcrypt hash that authService.login can verify against.
const TEST_BCRYPT_SALT_ROUNDS = 4;

export const DEFAULT_TEST_PASSWORD = "Password123";

type CreateTestUserOptions = {
  userName?: string;
  email?: string;
  password?: string;
  roles?: Role[];
};

// Inserts a user directly via Prisma, bypassing POST /auth/register —
// keeps non-auth integration tests fast and outside the auth rate limiter's
// concern entirely. Returns the plaintext password alongside the row since
// the stored value is hashed.
export const createTestUser = async (
  options: CreateTestUserOptions = {},
): Promise<User & { plainPassword: string }> => {
  const unique = randomUUID().slice(0, 8);
  const plainPassword = options.password ?? DEFAULT_TEST_PASSWORD;
  const hashedPassword = await bcrypt.hash(plainPassword, TEST_BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      userName: options.userName ?? `user_${unique}`,
      email: options.email ?? `user_${unique}@example.com`,
      password: hashedPassword,
      roles: options.roles ?? [Role.TECHNICIAN],
    },
  });

  return { ...user, plainPassword };
};

export const createAdminUser = (options: CreateTestUserOptions = {}) =>
  createTestUser({ ...options, roles: [Role.ADMIN] });

export const createManagerUser = (options: CreateTestUserOptions = {}) =>
  createTestUser({ ...options, roles: [Role.MANAGER] });

export const createTechnicianUser = (options: CreateTestUserOptions = {}) =>
  createTestUser({ ...options, roles: [Role.TECHNICIAN] });
