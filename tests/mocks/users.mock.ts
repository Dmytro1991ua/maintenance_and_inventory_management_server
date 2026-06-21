import { Role, User } from "../../src/generated/prisma/client";

export const buildUser = (overrides: Partial<User> = {}) => ({
  id: "user-1",
  userName: "johndoe",
  email: "john@example.com",
  password: "$2b$12$hashedpasswordvalue",
  roles: [Role.TECHNICIAN],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

export const buildAdminUser = (overrides = {}) =>
  buildUser({ id: "user-admin", roles: [Role.ADMIN], ...overrides });
export const buildManagerUser = (overrides = {}) =>
  buildUser({ id: "user-manager", roles: [Role.MANAGER], ...overrides });
export const buildTechnicianUser = (overrides = {}) =>
  buildUser({ id: "user-tech", roles: [Role.TECHNICIAN], ...overrides });
