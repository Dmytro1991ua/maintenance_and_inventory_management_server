import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import { authHeader, createAdminUser, createTechnicianUser, signTestAccessToken } from "../helpers";

const getMe = (token: string) => request(app).get("/api/v1/users/me").set(authHeader(token));

describe("an access token for a user whose account changed", () => {
  it("should work while the user is active", async () => {
    const user = await createTechnicianUser();

    const response = await getMe(signTestAccessToken(user));

    expect(response.status).toBe(200);
  });

  it("should be refused at once, still unexpired, once the user is deactivated", async () => {
    const user = await createTechnicianUser();
    const token = signTestAccessToken(user);
    expect((await getMe(token)).status).toBe(200);

    await prisma.user.update({ where: { id: user.id }, data: { status: "INACTIVE" } });

    const response = await getMe(token);
    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe("Your account has been deactivated");
  });

  it("should work again once the user is reactivated", async () => {
    const user = await createTechnicianUser();
    const token = signTestAccessToken(user);
    await prisma.user.update({ where: { id: user.id }, data: { status: "INACTIVE" } });
    await getMe(token);

    await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });

    expect((await getMe(token)).status).toBe(200);
  });

  it("should be refused once the user is deleted", async () => {
    const user = await createTechnicianUser();
    const token = signTestAccessToken(user);
    await prisma.user.delete({ where: { id: user.id } });

    expect((await getMe(token)).status).toBe(401);
  });

  it("should lock a deactivated user out of every route, not just /me", async () => {
    const admin = await createAdminUser();
    const token = signTestAccessToken(admin);
    await prisma.user.update({ where: { id: admin.id }, data: { status: "INACTIVE" } });

    const response = await request(app).get("/api/v1/tasks").set(authHeader(token));

    expect(response.status).toBe(403);
  });

  describe("roles", () => {
    const listUsers = (token: string) => request(app).get("/api/v1/users").set(authHeader(token));

    it("should apply a promotion at once, without a new token", async () => {
      const user = await createTechnicianUser();
      const token = signTestAccessToken(user);
      expect((await listUsers(token)).status).toBe(403);

      await prisma.user.update({ where: { id: user.id }, data: { roles: ["ADMIN"] } });

      expect((await listUsers(token)).status).toBe(200);
    });

    it("should apply a demotion at once, even with an admin token still unexpired", async () => {
      const admin = await createAdminUser();
      const token = signTestAccessToken(admin);
      expect((await listUsers(token)).status).toBe(200);

      await prisma.user.update({ where: { id: admin.id }, data: { roles: ["TECHNICIAN"] } });

      expect((await listUsers(token)).status).toBe(403);
    });
  });
});
