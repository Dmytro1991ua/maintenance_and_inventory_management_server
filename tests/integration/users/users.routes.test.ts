import request from "supertest";

import app from "../../../src/app";
import { prisma } from "../../../src/config";
import { UserStatus } from "../../../src/generated/prisma/client";
import {
  authHeader,
  createAdminUser,
  createManagerUser,
  createTechnicianUser,
  createTestTask,
  createTestUser,
  DEFAULT_TEST_PASSWORD,
  signTestAccessToken,
} from "../helpers";

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

describe("GET /api/v1/users", () => {
  it("should return a paginated list of users for ADMIN", async () => {
    const admin = await createAdminUser();
    await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/users")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta).toEqual({
      total: 2,
      page: 1,
      limit: 20,
      pages: 1,
    });
  });

  it("should return a list for MANAGER", async () => {
    const manager = await createManagerUser();

    const response = await request(app)
      .get("/api/v1/users")
      .set(authHeader(signTestAccessToken(manager)));

    expect(response.status).toBe(200);
  });

  it("should filter by role", async () => {
    const admin = await createAdminUser();
    await createManagerUser();
    await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/users?role=MANAGER")
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].roles).toEqual(["MANAGER"]);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/users")
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(403);
  });

  it("should return 401 when no token is provided", async () => {
    const response = await request(app).get("/api/v1/users");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/users/me", () => {
  it("should return the requesting user's own profile", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .get("/api/v1/users/me")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(user.id);
    expect(response.body.data).not.toHaveProperty("password");
  });

  it("should return 401 when no token is provided", async () => {
    const response = await request(app).get("/api/v1/users/me");

    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/users/:id", () => {
  it("should return the user for ADMIN", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .get(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(target.id);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .get(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(403);
  });

  it("should return 404 for a nonexistent user", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .get(`/api/v1/users/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/users/:id", () => {
  it("should allow a user to update their own profile", async () => {
    const user = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${user.id}`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ userName: "updatedname" });

    expect(response.status).toBe(200);
    expect(response.body.data.userName).toBe("updatedname");
  });

  it("should allow ADMIN to update another user's profile", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ userName: "adminupdated" });

    expect(response.status).toBe(200);
    expect(response.body.data.userName).toBe("adminupdated");
  });

  it("should return 403 when a non-admin tries to update another user's profile", async () => {
    const technician = await createTechnicianUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ userName: "hacked" });

    expect(response.status).toBe(403);
  });

  it("should return 409 when the new email is already in use", async () => {
    const user = await createTechnicianUser();
    const other = await createTestUser({ email: "other-taken@example.com" });

    const response = await request(app)
      .patch(`/api/v1/users/${user.id}`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ email: other.email });

    expect(response.status).toBe(409);
  });

  it("should return 409 when the new username is already taken", async () => {
    const user = await createTechnicianUser();
    const other = await createTestUser({ userName: "other_taken_name" });

    const response = await request(app)
      .patch(`/api/v1/users/${user.id}`)
      .set(authHeader(signTestAccessToken(user)))
      .send({ userName: other.userName });

    expect(response.status).toBe(409);
  });

  it("should return 404 when the target user does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch(`/api/v1/users/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ userName: "doesnotmatter" });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/users/:id/roles", () => {
  it("should update roles for ADMIN", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/roles`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ roles: ["MANAGER"] });

    expect(response.status).toBe(200);
    expect(response.body.data.roles).toEqual(["MANAGER"]);
  });

  it("should return 403 for non-admin", async () => {
    const manager = await createManagerUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/roles`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ roles: ["ADMIN"] });

    expect(response.status).toBe(403);
  });

  it("should return 404 when the target user does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch(`/api/v1/users/${NONEXISTENT_ID}/roles`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ roles: ["MANAGER"] });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/v1/users/:id/status", () => {
  it("should allow ADMIN to deactivate another user", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("INACTIVE");
  });

  it("should allow ADMIN to reactivate a user", async () => {
    const admin = await createAdminUser();
    const target = await createTestUser({ status: UserStatus.INACTIVE });

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ status: "ACTIVE" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ACTIVE");
  });

  it("should return 403 when ADMIN tries to change their own status", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch(`/api/v1/users/${admin.id}/status`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(403);
  });

  it("should return 403 for MANAGER", async () => {
    const manager = await createManagerUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set(authHeader(signTestAccessToken(manager)))
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(403);
  });

  it("should return 403 for TECHNICIAN", async () => {
    const technician = await createTechnicianUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set(authHeader(signTestAccessToken(technician)))
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(403);
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app)
      .patch(`/api/v1/users/${NONEXISTENT_ID}/status`)
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(401);
  });

  it("should return 404 when the target user does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .patch(`/api/v1/users/${NONEXISTENT_ID}/status`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(404);
  });

  it("should return 400 when status is an invalid value", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ status: "PENDING" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when status is missing", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return the full user shape in the response", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .patch(`/api/v1/users/${target.id}/status`)
      .set(authHeader(signTestAccessToken(admin)))
      .send({ status: "INACTIVE" });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: target.id,
      userName: expect.any(String),
      email: expect.any(String),
      roles: expect.any(Array),
      status: "INACTIVE",
    });
    expect(response.body.data).not.toHaveProperty("password");
  });
});

describe("PATCH /api/v1/users/me/password", () => {
  it("should return 204 on a valid password change", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .set(authHeader(signTestAccessToken(user)))
      .send({ currentPassword: DEFAULT_TEST_PASSWORD, newPassword: "NewPass456!" });

    expect(response.status).toBe(204);
  });

  it("should accept login with the new password after change", async () => {
    const user = await createTestUser();

    await request(app)
      .patch("/api/v1/users/me/password")
      .set(authHeader(signTestAccessToken(user)))
      .send({ currentPassword: DEFAULT_TEST_PASSWORD, newPassword: "NewPass456!" });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "NewPass456!" });

    expect(login.status).toBe(200);
  });

  it("should reject login with the old password after change", async () => {
    const user = await createTestUser();

    await request(app)
      .patch("/api/v1/users/me/password")
      .set(authHeader(signTestAccessToken(user)))
      .send({ currentPassword: DEFAULT_TEST_PASSWORD, newPassword: "NewPass456!" });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: DEFAULT_TEST_PASSWORD });

    expect(login.status).toBe(401);
  });

  it("should return 400 when current password is wrong", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .set(authHeader(signTestAccessToken(user)))
      .send({ currentPassword: "WrongPass999!", newPassword: "NewPass456!" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
    expect(response.body.error.message).toBe("Current password is incorrect");
  });

  it("should return 400 when new password is the same as current", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .set(authHeader(signTestAccessToken(user)))
      .send({ currentPassword: DEFAULT_TEST_PASSWORD, newPassword: DEFAULT_TEST_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it.each([
    ["too short", "Short1"],
    ["no uppercase letter", "nouppercase1"],
    ["no number", "NoNumbers!"],
  ])("should return 400 when newPassword has %s", async (_label, newPassword) => {
    const user = await createTestUser();

    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .set(authHeader(signTestAccessToken(user)))
      .send({ currentPassword: DEFAULT_TEST_PASSWORD, newPassword });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when currentPassword is missing", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .set(authHeader(signTestAccessToken(user)))
      .send({ newPassword: "NewPass456!" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when newPassword is missing", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .set(authHeader(signTestAccessToken(user)))
      .send({ currentPassword: DEFAULT_TEST_PASSWORD });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me/password")
      .send({ currentPassword: DEFAULT_TEST_PASSWORD, newPassword: "NewPass456!" });

    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/v1/users/me/sessions", () => {
  it("should return 204 and revoke all active sessions", async () => {
    const user = await createTestUser();

    // Real login so a refresh token lands in Redis
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: DEFAULT_TEST_PASSWORD });

    expect(loginRes.status).toBe(200);
    const refreshToken = loginRes.headers["set-cookie"]?.[0];

    const response = await request(app)
      .delete("/api/v1/users/me/sessions")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(204);

    // Refresh token should no longer work
    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", refreshToken ?? "");

    expect(refreshRes.status).toBe(401);
  });

  it("should return 204 even when there are no active sessions to revoke", async () => {
    const user = await createTestUser();

    // Call twice — second call hits an already-empty session set
    await request(app)
      .delete("/api/v1/users/me/sessions")
      .set(authHeader(signTestAccessToken(user)));

    const response = await request(app)
      .delete("/api/v1/users/me/sessions")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(204);
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app).delete("/api/v1/users/me/sessions");

    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/v1/users/me", () => {
  it("should return 204 and remove the account", async () => {
    const user = await createTestUser();

    const response = await request(app)
      .delete("/api/v1/users/me")
      .set(authHeader(signTestAccessToken(user)));

    expect(response.status).toBe(204);
  });

  it("should make the account unreachable by an admin after deletion", async () => {
    const admin = await createAdminUser();
    const user = await createTestUser();

    await request(app)
      .delete("/api/v1/users/me")
      .set(authHeader(signTestAccessToken(user)));

    const lookup = await request(app)
      .get(`/api/v1/users/${user.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(lookup.status).toBe(404);
  });

  it("should prevent login after account deletion", async () => {
    const user = await createTestUser();

    await request(app)
      .delete("/api/v1/users/me")
      .set(authHeader(signTestAccessToken(user)));

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: DEFAULT_TEST_PASSWORD });

    expect(login.status).toBe(401);
  });

  it("should reset IN_PROGRESS tasks to OPEN on account deletion", async () => {
    const user = await createTestUser();
    const task = await createTestTask({ assignedTo: user.id, status: "IN_PROGRESS" });

    await request(app)
      .delete("/api/v1/users/me")
      .set(authHeader(signTestAccessToken(user)));

    const updated = await prisma.task.findUnique({ where: { id: task.id } });

    expect(updated?.status).toBe("OPEN");
    expect(updated?.assignedTo).toBeNull();
  });

  it("should return 401 when unauthenticated", async () => {
    const response = await request(app).delete("/api/v1/users/me");

    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/v1/users/:id", () => {
  it("should allow ADMIN to delete another user", async () => {
    const admin = await createAdminUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .delete(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(204);
  });

  it("should return 403 when ADMIN tries to delete their own account", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .delete(`/api/v1/users/${admin.id}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(403);
  });

  it("should return 403 for non-admin", async () => {
    const technician = await createTechnicianUser();
    const target = await createTechnicianUser();

    const response = await request(app)
      .delete(`/api/v1/users/${target.id}`)
      .set(authHeader(signTestAccessToken(technician)));

    expect(response.status).toBe(403);
  });

  it("should return 404 when the target user does not exist", async () => {
    const admin = await createAdminUser();

    const response = await request(app)
      .delete(`/api/v1/users/${NONEXISTENT_ID}`)
      .set(authHeader(signTestAccessToken(admin)));

    expect(response.status).toBe(404);
  });
});
