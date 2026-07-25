import { Role, UserInvite } from "../../src/generated/prisma/client";

export const buildInvite = (overrides: Partial<UserInvite> = {}): UserInvite => ({
  id: "invite-1",
  email: "jane@example.com",
  role: Role.TECHNICIAN,
  token: "550e8400-e29b-41d4-a716-446655440000",
  expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  usedAt: null,
  createdAt: new Date("2026-07-25T00:00:00.000Z"),
  ...overrides,
});
